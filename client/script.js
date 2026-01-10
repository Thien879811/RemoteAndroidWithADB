const API_URL = 'http://localhost:3001/api';

async function refreshDevices() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}/devices`);
        const devices = await response.json();
        renderDevices(devices);
        updateToolDeviceSelect(devices);
    } catch (error) {
        notify('Failed to fetch devices', 'danger');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function updateToolDeviceSelect(devices) {
    const select = document.getElementById('tool-device-select');
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose a device --</option>';
    devices.filter(d => d.type === 'device').forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.innerText = `${d.customName || d.model} (${d.id})`;
        select.appendChild(opt);
    });
    select.value = currentVal;
    if (currentVal) loadDeviceApps();
}

function switchView(view) {
    document.getElementById('devices-view').style.display = view === 'devices' ? 'block' : 'none';
    document.getElementById('tools-view').style.display = view === 'tools' ? 'block' : 'none';

    // Handle nav active state
    const items = document.querySelectorAll('.nav-item');
    items.forEach(item => {
        if (item.innerText.toLowerCase().includes(view)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    if (view === 'tools') {
        refreshDevices();
    }
}

async function loadDeviceApps() {
    const id = document.getElementById('tool-device-select').value;
    const container = document.getElementById('tool-sections');
    const list = document.getElementById('app-list');

    if (!id) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    list.innerHTML = '<p style="color: var(--text-dim); text-align: center;">Loading apps...</p>';

    try {
        const response = await fetch(`${API_URL}/device/${id}/apps`);
        const data = await response.json();
        if (data.success) {
            list.innerHTML = '';
            if (data.packages.length === 0) {
                list.innerHTML = '<p style="color: var(--text-dim); text-align: center;">No 3rd party apps found.</p>';
            }
            data.packages.forEach(pkg => {
                const item = document.createElement('div');
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);';
                item.innerHTML = `
                            <span style="font-size: 0.85rem; color: var(--text-dim);">${pkg}</span>
                            <button class="btn-disconnect" style="padding: 4px 10px; font-size: 10px;" onclick="uninstallApp('${id}', '${pkg}')">Uninstall</button>
                        `;
                list.appendChild(item);
            });
        }
    } catch (err) {
        notify('Failed to load apps', 'danger');
    }
}

async function openUrl() {
    const id = document.getElementById('tool-device-select').value;
    const url = document.getElementById('tool-url').value;
    if (!url) return notify('Please enter a URL', 'danger');

    try {
        const response = await fetch(`${API_URL}/device/${id}/open-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (data.success) notify('URL opened on device', 'success');
    } catch (err) {
        notify('Failed to open URL', 'danger');
    }
}

async function uninstallApp(id, pkg) {
    if (!confirm(`Uninstall ${pkg}?`)) return;
    notify(`Uninstalling ${pkg}...`);
    try {
        const response = await fetch(`${API_URL}/device/${id}/uninstall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ packageName: pkg })
        });
        const data = await response.json();
        if (data.success) {
            notify('App uninstalled', 'success');
            loadDeviceApps();
        }
    } catch (err) {
        notify('Uninstall failed', 'danger');
    }
}

async function installApk() {
    const id = document.getElementById('tool-device-select').value;
    const fileInput = document.getElementById('tool-apk');
    if (!fileInput.files[0]) return notify('Please select an APK file', 'danger');

    const formData = new FormData();
    formData.append('apk', fileInput.files[0]);

    showLoading(true);
    notify('Uploading and installing APK...');

    try {
        const response = await fetch(`${API_URL}/device/${id}/install`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            notify('Installation successful', 'success');
            fileInput.value = '';
            loadDeviceApps();
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        notify('Installation failed: ' + err.message, 'danger');
    } finally {
        showLoading(false);
    }
}

function renderDevices(devices) {
    const grid = document.getElementById('device-grid');
    const countEl = document.getElementById('device-count');
    grid.innerHTML = '';
    countEl.innerText = devices.length;

    if (devices.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-dim);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line></svg>
                    <p>No devices detected. Connect via USB or WiFi.</p>
                </div>`;
        return;
    }

    devices.forEach(device => {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.innerHTML = `
                    <div class="device-header">
                        <div class="device-info">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <h3>${device.customName || device.model}</h3>
                                <button class="btn-disconnect" style="padding: 2px 5px; font-size: 10px; opacity: 0.5;" onclick="editDeviceName('${device.id}', '${device.customName || device.model}')">✎</button>
                            </div>
                            <span class="device-status ${device.type === 'device' ? 'status-online' : 'status-offline'}">
                                ${device.type}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="color: var(--text-dim); font-size: 0.75rem;">${device.id}</div>
                            ${device.id.includes(':') ? `<button class="btn-disconnect" onclick="disconnectDevice('${device.id}')">Disconnect</button>` : ''}
                        </div>
                    </div>
                    <div class="device-details">
                        <div class="detail-item">
                            <span>Manufacturer</span>
                            <strong>${device.manufacturer || '-'}</strong>
                        </div>
                        <div class="detail-item">
                            <span>Android Version</span>
                            <strong>${device.version || '-'} (SDK ${device.sdk || '-'})</strong>
                        </div>
                        <div class="detail-item" style="grid-column: span 2; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; margin-top: 0.5rem;">
                            <span>Network IP</span>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong id="ip-${device.id.replace(/[^a-zA-Z0-9]/g, '_')}">${device.id.includes(':') ? device.id.split(':')[0] : 'Not discovered'}</strong>
                                ${!device.id.includes(':') ? `<button class="btn-disconnect" style="padding: 2px 8px; font-size: 10px; border-color: var(--accent); color: var(--accent); background: transparent;" onclick="fetchIpOnly('${device.id}')">Fetch IP</button>` : ''}
                            </div>
                            <div id="raw-ip-${device.id.replace(/[^a-zA-Z0-9]/g, '_')}" style="font-size: 0.65rem; color: var(--text-dim); margin-top: 0.4rem; font-family: monospace; line-height: 1.2; display: none; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div class="device-actions">
                        <button class="btn-action" onclick="controlDevice('${device.id}', 'home')" title="Home">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        </button>
                        <button class="btn-action" onclick="controlDevice('${device.id}', 'back')" title="Back">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <button class="btn-action" onclick="controlDevice('${device.id}', 'power')" title="Power">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                        </button>
                        ${!device.id.includes(':') ? `
                        <button class="btn-action" onclick="enableTcpip('${device.id}')" title="Enable ADB TCP/IP 5555" style="color: var(--success); border-color: rgba(16, 185, 129, 0.2);">
                           <span style="font-size: 10px; font-weight: bold;">TCP</span>
                        </button>
                        <button class="btn-action" onclick="setupWireless('${device.id}')" title="One-Click Wireless Setup" style="color: var(--accent); border-color: rgba(34, 211, 238, 0.2);">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
                        </button>
                        ` : ''}
                    </div>
                    <button class="btn-primary-action" onclick="launchScrcpy('${device.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
                        Launch Remote Screen
                    </button>
                `;
        grid.appendChild(card);
    });
}

async function launchScrcpy(id) {
    notify('Launching Remote Screen...');
    try {
        const response = await fetch(`${API_URL}/scrcpy/${id}`, { method: 'POST' });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
    } catch (error) {
        notify('Error launching Scrcpy: ' + error.message, 'danger');
    }
}

async function controlDevice(id, action) {
    try {
        await fetch(`${API_URL}/control/${id}/${action}`, { method: 'POST' });
        notify(`Action ${action} sent`);
    } catch (error) {
        notify('Control failed', 'danger');
    }
}

function showAddModal() {
    document.getElementById('add-modal').style.display = 'flex';
}

function hideAddModal() {
    document.getElementById('add-modal').style.display = 'none';
}

async function connectDevice() {
    const ip = document.getElementById('device-ip').value;
    const port = document.getElementById('device-port').value;
    const name = document.getElementById('device-nickname').value;

    if (!ip) {
        notify('Please enter an IP address', 'danger');
        return;
    }

    notify(`Connecting to ${ip}:${port}...`);
    hideAddModal();

    try {
        const response = await fetch(`${API_URL}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port, name })
        });
        const result = await response.json();
        if (result.success) {
            notify('Connected successfully', 'success');
            document.getElementById('device-nickname').value = '';
            refreshDevices();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        notify('Connection failed: ' + error.message, 'danger');
    }
}

async function editDeviceName(id, currentName) {
    const newName = prompt('Enter a custom name for this device:', currentName);
    if (newName === null) return;

    try {
        const response = await fetch(`${API_URL}/device/${id}/name`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const data = await response.json();
        if (data.success) {
            notify('Name updated', 'success');
            refreshDevices();
        }
    } catch (err) {
        notify('Failed to update name', 'danger');
    }
}

async function disconnectDevice(id) {
    notify(`Disconnecting ${id}...`);
    try {
        const response = await fetch(`${API_URL}/disconnect/${id}`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            notify('Disconnected successfully');
            refreshDevices();
        }
    } catch (error) {
        notify('Disconnect failed', 'danger');
    }
}

async function setupWireless(id) {
    try {
        notify(`Starting one-click setup for ${id}...`);
        showLoading(true);

        const response = await fetch(`${API_URL}/device/${id}/setup-wireless`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            notify(`Wireless bridge established: ${data.ip}`, 'success');
            refreshDevices();
        } else {
            throw new Error(data.error || 'Setup failed');
        }
    } catch (error) {
        notify(error.message, 'danger');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

async function enableTcpip(id) {
    try {
        notify(`Enabling TCP/IP 5555 for ${id}...`);
        const response = await fetch(`${API_URL}/device/${id}/tcpip`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            notify('TCP mode enabled. You can now connect via IP.', 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        notify('TCP/IP failed: ' + error.message, 'danger');
    }
}

async function fetchIpOnly(id) {
    const safeId = id.replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById(`ip-${safeId}`);
    const rawEl = document.getElementById(`raw-ip-${safeId}`);
    const originalText = el.innerText;

    el.innerText = 'Searching...';
    rawEl.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/device/${id}/ip`);
        const data = await response.json();
        if (data.success) {
            el.innerText = data.ip;
            if (data.rawOutput) {
                rawEl.innerText = data.rawOutput;
                rawEl.style.display = 'block';
            }
            notify(`IP discovered: ${data.ip}`, 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        el.innerText = originalText;
        notify('IP Discovery failed: ' + error.message, 'danger');
    }
}

async function setupAllWireless() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}/devices`);
        const devices = await response.json();
        const usbDevices = devices.filter(d => !d.id.includes(':') && d.type === 'device');

        if (usbDevices.length === 0) {
            notify('No USB devices found for wireless setup');
            return;
        }

        notify(`Found ${usbDevices.length} USB devices. Starting batch setup...`);

        for (const device of usbDevices) {
            await setupWireless(device.id);
            // Tiny delay between setups
            await new Promise(r => setTimeout(r, 1000));
        }

        notify('Batch wireless setup complete!', 'success');
    } catch (err) {
        notify('Batch setup failed', 'danger');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function notify(message, type = 'info') {
    const box = document.getElementById('notification-box');
    const note = document.createElement('div');
    note.className = 'notification';
    if (type === 'danger') note.style.borderLeftColor = 'var(--danger)';
    note.innerText = message;
    box.appendChild(note);

    // Also log to console
    logToConsole(message, type);

    setTimeout(() => {
        note.style.opacity = '0';
        note.style.transform = 'translateX(20px)';
        setTimeout(() => note.remove(), 300);
    }, 3000);
}

function logToConsole(message, type = 'info') {
    const consoleBox = document.getElementById('console-container');
    const output = document.getElementById('console-output');
    consoleBox.style.display = 'flex';

    const line = document.createElement('span');
    const time = new Date().toLocaleTimeString();
    line.innerHTML = `<small style="color: var(--text-dim)">[\${time}]</small> <span style="color: \${type === 'danger' ? 'var(--danger)' : 'var(--accent)'}">\${message}</span>`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

function clearConsole() {
    document.getElementById('console-output').innerHTML = '<span>Console cleared.</span>';
}

// Initial Load
window.onload = refreshDevices;
