const express = require('express');
const Adb = require('adbkit');
const cors = require('cors');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3001;
const adb = Adb.createClient();

// Configure multer for APK uploads
const upload = multer({ dest: 'uploads/' });

// Persistent storage for device names
const NAMES_FILE = path.join(__dirname, 'names.json');
let deviceNames = {};

function loadNames() {
    try {
        if (fs.existsSync(NAMES_FILE)) {
            deviceNames = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error loading names:', e); }
}

function saveNames() {
    try {
        fs.writeFileSync(NAMES_FILE, JSON.stringify(deviceNames, null, 2));
    } catch (e) { console.error('Error saving names:', e); }
}

loadNames();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../client'));

// Get list of devices
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await adb.listDevices();
        const detailedDevices = await Promise.all(devices.map(async (device) => {
            try {
                const properties = await adb.getProperties(device.id);
                return {
                    id: device.id,
                    type: device.type,
                    model: properties['ro.product.model'] || 'Unknown',
                    manufacturer: properties['ro.product.manufacturer'] || 'Unknown',
                    version: properties['ro.build.version.release'] || 'Unknown',
                    sdk: properties['ro.build.version.sdk'] || 'Unknown',
                    customName: deviceNames[device.id] || null
                };
            } catch (err) {
                console.error(`Error getting properties for ${device.id}:`, err.message);
                return {
                    id: device.id,
                    type: device.type,
                    model: 'Offline',
                    customName: deviceNames[device.id] || null
                };
            }
        }));
        res.json(detailedDevices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update standard device name
app.post('/api/device/:id/name', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    deviceNames[id] = name;
    saveNames();
    res.json({ success: true });
});

// Launch Scrcpy
app.post('/api/scrcpy/:id', (req, res) => {
    const { id } = req.params;
    const { options } = req.body || {};

    // Construct scrcpy command
    let command = `scrcpy -s ${id} --window-title "Remote: ${id}"`;
    if (options) {
        if (options.alwaysOnTop) command += ' --always-on-top';
        if (options.noControl) command += ' --no-control';
        if (options.bitrate) command += ` -b ${options.bitrate}M`;
    }

    console.log(`Executing: ${command}`);

    exec(command, (error) => {
        if (error) {
            console.error(`scrcpy error: ${error}`);
        }
    });

    res.json({ success: true, message: 'Scrcpy launched' });
});

// Basic ADB Controls
app.post('/api/control/:id/:action', async (req, res) => {
    const { id, action } = req.params;

    try {
        switch (action) {
            case 'home':
                await adb.shell(id, 'input keyevent 3');
                break;
            case 'back':
                await adb.shell(id, 'input keyevent 4');
                break;
            case 'power':
                await adb.shell(id, 'input keyevent 26');
                break;
            case 'volume_up':
                await adb.shell(id, 'input keyevent 24');
                break;
            case 'volume_down':
                await adb.shell(id, 'input keyevent 25');
                break;
            case 'reboot':
                await adb.reboot(id);
                break;
            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Enable TCP/IP on a device
app.post('/api/device/:id/tcpip', async (req, res) => {
    const { id } = req.params;
    try {
        await adb.tcpip(id, 5555);
        res.json({ success: true, message: 'TCP mode enabled on port 5555' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get device IP using ip route
app.get('/api/device/:id/ip', async (req, res) => {
    const { id } = req.params;
    try {
        // adb is already the client created by Adb.createClient()
        const output = await adb.shell(id, 'ip route');
        console.log(output);
        let ip = null;

        // Read the stream
        const chunks = [];
        output.on('data', chunk => chunks.push(chunk));
        output.on('end', async () => {
            const result = Buffer.concat(chunks).toString();
            // Try ip route src first
            let match = result.match(/src\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);

            if (!match) {
                // Fallback: Try ip addr show wlan0
                try {
                    const fallbackOutput = await adb.shell(id, 'ip addr show wlan0');
                    const fbChunks = [];
                    fallbackOutput.on('data', c => fbChunks.push(c));
                    await new Promise(resolve => fallbackOutput.on('end', resolve));
                    const fbResult = Buffer.concat(fbChunks).toString();
                    match = fbResult.match(/inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
                } catch (e) { }
            }

            if (match) {
                res.json({ success: true, ip: match[1], rawOutput: result.trim() });
            } else {
                res.status(404).json({ error: 'Could not detect IP', output: result });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Atomic Wireless Setup
app.post('/api/device/:id/setup-wireless', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`Starting wireless setup for ${id}...`);

        // 1. Enable TCP/IP
        await adb.tcpip(id, 5555);
        console.log(`TCP/IP 5555 enabled for ${id}`);

        // 2. Get IP address (wait a bit for daemon to restart)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const output = await adb.shell(id, 'ip route');

        const chunks = [];
        output.on('data', chunk => chunks.push(chunk));
        output.on('end', async () => {
            const result = Buffer.concat(chunks).toString();
            const match = result.match(/src\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);

            if (!match) {
                return res.status(404).json({ error: 'Could not detect IP from route', output: result });
            }

            const ip = match[1];
            console.log(`Detected IP: ${ip} for ${id}`);

            // 3. Connect
            try {
                await adb.connect(ip, 5555);
                res.json({ success: true, ip, id: `${ip}:5555` });
            } catch (connErr) {
                res.status(500).json({ error: 'Connect failed', details: connErr.message });
            }
        });
    } catch (err) {
        console.error(`Setup wireless failed for ${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Connect via TCP/IP
app.post('/api/connect', async (req, res) => {
    const { ip, port = 5555, name } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    try {
        const id = `${ip}:${port}`;
        await adb.connect(ip, port);

        if (name) {
            deviceNames[id] = name;
            saveNames();
        }

        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disconnect device
app.post('/api/disconnect/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [ip, port] = id.split(':');
        await adb.disconnect(ip, port || 5555);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Open Website
app.post('/api/device/:id/open-url', async (req, res) => {
    const { id } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        await adb.shell(id, `am start -a android.intent.action.VIEW -d "${url}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List Apps
app.get('/api/device/:id/apps', async (req, res) => {
    const { id } = req.params;
    try {
        const output = await adb.shell(id, 'pm list packages -3'); // -3 for 3rd party apps
        const chunks = [];
        output.on('data', chunk => chunks.push(chunk));
        output.on('end', () => {
            const result = Buffer.concat(chunks).toString();
            const packages = result.split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => line.replace('package:', '').trim())
                .sort();
            res.json({ success: true, packages });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Uninstall App
app.post('/api/device/:id/uninstall', async (req, res) => {
    const { id } = req.params;
    const { packageName } = req.body;
    if (!packageName) return res.status(400).json({ error: 'Package name is required' });

    try {
        await adb.uninstall(id, packageName);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Install App (APK Upload)
app.post('/api/device/:id/install', upload.single('apk'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'APK file is required' });

    const apkPath = req.file.path;
    try {
        await adb.install(id, apkPath);
        // Cleanup file
        fs.unlinkSync(apkPath);
        res.json({ success: true, message: 'App installed successfully' });
    } catch (err) {
        if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`ADB Bridge listening at http://localhost:${port}`);
});
