import { App, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, Notice, Modal, DropdownComponent, ButtonComponent, setIcon, moment, TFile, normalizePath } from 'obsidian';
import { t, resources, LangType, LocaleKey } from './i18n';

// --- Data Models ---

interface Precedent {
    id: string;
    name: string;
    description: string;
    autoFailMinutes: number;
    usageCount: number;
}

interface CTDPTask {
    id: string;
    name: string;
    description: string;
    sessionDuration: number;
    bookingDuration: number;
    state: 'IDLE' | 'BOOKED' | 'ACTIVE' | 'PAUSED';
    mainChainCount: number;
    auxChainCount: number;
    bookingStartTime: number | null;
    sessionStartTime: number | null;
    pauseStartTime: number | null;
    activePrecedentId: string | null;
    precedents: Precedent[];
    logBookingStartTime: number | null;
    logPrecedents: string[];
}

interface CTDPSettings {
    version: number;
    tasks: CTDPTask[];
    activeTaskId: string | null;
    enableNotifications: boolean;
    language: string;
    dailyLogFormat: string;
    dailyLogFolder: string;
    enableStatusBarTimer: boolean;
}

const CURRENT_SETTINGS_VERSION = 1;

const DEFAULT_SETTINGS: CTDPSettings = {
    version: CURRENT_SETTINGS_VERSION,
    tasks: [],
    activeTaskId: null,
    enableNotifications: true,
    language: 'system',
    dailyLogFormat: 'YYYY-MM-DD',
    dailyLogFolder: '',
    enableStatusBarTimer: true
}

const VIEW_TYPE_CTDP = "ctdp-view";

// --- Plugin Class ---

export default class CTDPPlugin extends Plugin {
    settings: CTDPSettings;
    checkInterval: number;
    statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();

        // 1. Auto-select first task if none selected (Safe place, not in render)
        if (!this.settings.activeTaskId && this.settings.tasks.length > 0) {
            this.settings.activeTaskId = this.settings.tasks[0].id;
            await this.saveSettings();
        }

        // 2. Auto-detect daily note settings if defaults
        if (this.settings.dailyLogFormat === 'YYYY-MM-DD' && this.settings.dailyLogFolder === '') {
             try {
                 // @ts-ignore
                 const dailyNotesPlugin = this.app.internalPlugins.getPluginById("daily-notes");
                 if (dailyNotesPlugin && dailyNotesPlugin.instance && dailyNotesPlugin.instance.options) {
                     this.settings.dailyLogFormat = dailyNotesPlugin.instance.options.format || 'YYYY-MM-DD';
                     this.settings.dailyLogFolder = dailyNotesPlugin.instance.options.folder || '';
                     await this.saveSettings();
                 }
             } catch(e) { /* Auto-detect failed silently */ }
        }

        this.statusBarItem = this.addStatusBarItem();
        this.registerView(VIEW_TYPE_CTDP, (leaf) => new CTDPView(leaf, this));

        this.addRibbonIcon('target', 'CTDP Dashboard', () => { this.activateView(); });
        this.addCommand({ id: 'open-ctdp-view', name: 'Open Dashboard', callback: () => { this.activateView(); } });
        this.addSettingTab(new CTDPSettingTab(this.app, this));

        this.checkInterval = window.setInterval(() => {
            this.checkTimers().catch(() => { /* Timer error handled silently */ });
        }, 1000);
    }

    async onunload() { window.clearInterval(this.checkInterval); }

    getLang(): string {
        if (this.settings.language !== 'system') return this.settings.language;
        const locale = moment.locale();
        if (locale.startsWith('zh')) return 'zh';
        return 'en';
    }

    tr(key: LocaleKey, ...args: string[]): string {
        let str = t(key, this.getLang());
        args.forEach((arg, i) => {
            str = str.replace(`{${i}}`, arg);
        });
        return str;
    }

    async checkTimers() {
        let dirty = false;
        const now = Date.now();
        if (!this.settings.tasks) return;
        let statusBarText = "";
        const activeTaskId = this.settings.activeTaskId;
        let viewNeedsRefresh = false;

        for (const task of this.settings.tasks) {
            // Ensure fields exist
            if (!task.logPrecedents) task.logPrecedents = [];
            
            const oldState = task.state;
            const oldSessionStart = task.sessionStartTime;

            // Auto-Transitions
            if (task.state === 'BOOKED' && task.bookingStartTime) {
                if (now - task.bookingStartTime >= task.bookingDuration * 60 * 1000) {
                    task.auxChainCount++; 
                    task.state = 'ACTIVE'; 
                    task.sessionStartTime = Date.now();
                    task.bookingStartTime = null; task.pauseStartTime = null; task.activePrecedentId = null;
                    this.notify(this.tr("Sacred Seat Started!"), this.tr("Session Started Body", task.name));
                    dirty = true;
                    viewNeedsRefresh = true;
                }
            }
            if (task.state === 'ACTIVE' && task.sessionStartTime) {
                if (now - task.sessionStartTime >= task.sessionDuration * 60 * 1000) {
                    // Complete Session
                    await this.logToDailyNote(task);
                    task.mainChainCount++; 
                    task.state = 'IDLE'; 
                    task.sessionStartTime = null; 
                    task.logBookingStartTime = null; 
                    task.logPrecedents = [];
                    
                    this.notify(this.tr("Session Complete!"), this.tr("Session Complete Body", task.name));
                    dirty = true;
                    viewNeedsRefresh = true;
                }
            }
            if (task.state === 'PAUSED' && task.pauseStartTime && task.activePrecedentId) {
                const p = task.precedents.find(pr => pr.id === task.activePrecedentId);
                if (p && now - task.pauseStartTime >= p.autoFailMinutes * 60 * 1000) {
                    this.notify(this.tr("Pause Limit Exceeded!"), this.tr("Pause Limit Body", task.name));
                    this.failChainInternal(task);
                    dirty = true;
                    viewNeedsRefresh = true;
                }
            }

            if (task.state !== oldState) viewNeedsRefresh = true;

            // StatusBar Logic
            if (this.settings.enableStatusBarTimer && task.id === activeTaskId) {
                if (task.state === 'ACTIVE' && task.sessionStartTime) {
                    statusBarText = `🎯 ${this.formatTime((task.sessionDuration*60000)-(now-task.sessionStartTime))}`;
                } else if (task.state === 'BOOKED' && task.bookingStartTime) {
                    statusBarText = `🗓️ ${this.formatTime((task.bookingDuration*60000)-(now-task.bookingStartTime))}`;
                } else if (task.state === 'PAUSED' && task.pauseStartTime && task.activePrecedentId) {
                    const p = task.precedents.find(pr => pr.id === task.activePrecedentId);
                    if(p) statusBarText = `⏸️ ${this.formatTime((p.autoFailMinutes*60000)-(now-task.pauseStartTime))}`;
                }
            }
        }
        
        if (this.statusBarItem) {
            this.statusBarItem.setText(statusBarText);
            this.statusBarItem.style.display = statusBarText ? "inline-block" : "none";
        }
        
        if (dirty) await this.saveSettings();
        if (viewNeedsRefresh) this.refreshView();
    }

    refreshView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CTDP);
        leaves.forEach(leaf => { if (leaf.view instanceof CTDPView) leaf.view.render(); });
    }

    notify(title: string, body: string) {
        new Notice(`${title}\n${body}`);
        if (this.settings.enableNotifications && Notification.permission === 'granted') new Notification(title, { body });
    }

    formatTime(ms: number): string {
        if(ms < 0) ms = 0;
        const totalSeconds = Math.ceil(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    async loadSettings() {
        const loaded = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

        // Data migration
        await this.migrateSettings();

        // Ensure tasks array exists
        if (!this.settings.tasks) {
            this.settings.tasks = [];
        }

        // Ensure each task has required fields
        this.settings.tasks.forEach(t => {
            if (!t.logPrecedents) t.logPrecedents = [];
            if (t.logBookingStartTime === undefined) t.logBookingStartTime = null;
        });
    }

    async migrateSettings() {
        const currentVersion = this.settings.version || 0;
        let needsSave = false;

        // Migration from version 0 (no version) to version 1
        if (currentVersion < 1) {
            if (this.settings.tasks) {
                this.settings.tasks.forEach(t => {
                    if (t.logPrecedents === undefined) t.logPrecedents = [];
                    if (t.logBookingStartTime === undefined) t.logBookingStartTime = null;
                });
            }
            this.settings.version = 1;
            needsSave = true;
        }

        // Future migrations can be added here:
        // if (currentVersion < 2) { ... }

        if (needsSave) {
            await this.saveData(this.settings);
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getTask(id: string): CTDPTask | undefined {
        return this.settings.tasks ? this.settings.tasks.find(t => t.id === id) : undefined;
    }

    async bookSession(taskId: string) {
        const t = this.getTask(taskId);
        if (!t) return;

        // If booking duration is 0 or less, start immediately
        if (t.bookingDuration <= 0) {
            await this.startSession(taskId);
            return;
        }

        t.state = 'BOOKED';
        t.bookingStartTime = Date.now();
        t.logBookingStartTime = t.bookingStartTime;
        t.logPrecedents = [];
        await this.saveSettings();
        this.refreshView();
    }

    async startSession(taskId: string) {
        const t = this.getTask(taskId);
        if (!t) return;

        if (t.state === 'BOOKED') {
            t.auxChainCount++;
        }
        t.state = 'ACTIVE';
        t.sessionStartTime = Date.now();
        if (!t.logBookingStartTime && t.bookingStartTime) {
            t.logBookingStartTime = t.bookingStartTime;
        }
        t.bookingStartTime = null;
        await this.saveSettings();
        this.refreshView();
    }

    async pauseSession(taskId: string, pid: string) {
        const t = this.getTask(taskId);
        if (!t) return;

        const p = t.precedents.find(pr => pr.id === pid);
        if (!p) return;

        t.state = 'PAUSED';
        t.pauseStartTime = Date.now();
        t.activePrecedentId = pid;
        p.usageCount++;
        if (!t.logPrecedents) {
            t.logPrecedents = [];
        }
        t.logPrecedents.push(p.name);
        await this.saveSettings();
        this.refreshView();
    }

    async resumeSession(taskId: string) {
        const t = this.getTask(taskId);
        if (!t) return;

        // Adjust session start time to account for pause duration
        if (t.pauseStartTime && t.sessionStartTime) {
            t.sessionStartTime += (Date.now() - t.pauseStartTime);
        }

        t.state = 'ACTIVE';
        t.pauseStartTime = null;
        t.activePrecedentId = null;
        await this.saveSettings();
        this.refreshView();
    }
    async completeSession(taskId: string) {
        const t = this.getTask(taskId);
        if (!t) return;

        await this.logToDailyNote(t);
        t.mainChainCount++;
        t.state = 'IDLE';
        t.sessionStartTime = null;
        t.logBookingStartTime = null;
        t.logPrecedents = [];
        await this.saveSettings();
        this.refreshView();
    }

    async failChain(taskId: string) {
        const t = this.getTask(taskId);
        if (!t) return;

        this.failChainInternal(t);
        await this.saveSettings();
        this.refreshView();
    }

    failChainInternal(t: CTDPTask) {
        t.state = 'IDLE';
        t.mainChainCount = 0;
        t.auxChainCount = 0;
        t.precedents = [];
        t.sessionStartTime = null;
        t.bookingStartTime = null;
        t.pauseStartTime = null;
        t.activePrecedentId = null;
        t.logBookingStartTime = null;
        t.logPrecedents = [];
    }
    
    async logToDailyNote(task: CTDPTask) {
        try {
            const now = moment();
            const logLine = `- [x] ${moment(task.sessionStartTime).format("HH:mm")} - ${now.format("HH:mm")} 🎯 **${task.name}** (⏰ Booked: ${task.logBookingStartTime ? moment(task.logBookingStartTime).format("HH:mm") : "Direct"}${task.logPrecedents?.length > 0 ? ", ⏸️ Exceptions: " + task.logPrecedents.join(", ") : ""})`;

            const folder = this.settings.dailyLogFolder || "";
            const format = this.settings.dailyLogFormat || "YYYY-MM-DD";
            // Fix path construction: Normalize first
            const fileName = now.format(format);
            const pathWithExt = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
            const fullPath = folder ? `${folder}/${pathWithExt}` : pathWithExt;
            const normalizedPath = normalizePath(fullPath);

            let file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (!file) {
                if (folder) await this.ensureFolderExists(folder);
                file = await this.app.vault.create(normalizedPath, "");
            }

            if (file instanceof TFile) {
                await this.app.vault.process(file, (data) => {
                    const prefix = (data.length > 0 && !data.endsWith("\n")) ? "\n" : "";
                    return data + prefix + logLine;
                });
                new Notice(this.tr("Logged to Daily Note"));
            }
        } catch (e) {
            new Notice("CTDP: Log failed");
        }
    }

    async ensureFolderExists(path: string) {
        const dirs = path.replace(/\\/g, "/").split("/");
        let current = "";
        for (const dir of dirs) {
            if (!dir) continue;
            current = current ? `${current}/${dir}` : dir;
            const loaded = this.app.vault.getAbstractFileByPath(current);
            if (!loaded) {
                await this.app.vault.createFolder(current);
            }
        }
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_CTDP);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            // Try to get right leaf, fallback to new leaf if null
            leaf = workspace.getRightLeaf(false);
            if (!leaf) {
                leaf = workspace.getLeaf('tab');
            }
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_CTDP, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        } else {
            new Notice("CTDP: Failed to open dashboard");
        }
    }
}

// --- Views & Modals ---

class CTDPView extends ItemView {
    plugin: CTDPPlugin;
    timerInterval: number | undefined;

    constructor(leaf: WorkspaceLeaf, plugin: CTDPPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() { return VIEW_TYPE_CTDP; }
    getDisplayText() { return this.plugin.tr("CTDP Dashboard"); }
    getIcon() { return "target"; }

    async onOpen() {
        this.render();
        this.timerInterval = window.setInterval(() => { this.updateTimers(); }, 100);
    }

    async onClose() { window.clearInterval(this.timerInterval); }

    getActiveTask(): CTDPTask | null {
        if (!this.plugin.settings.activeTaskId) return null;
        return this.plugin.settings.tasks.find((t: CTDPTask) => t.id === this.plugin.settings.activeTaskId) || null;
    }

    render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('ctdp-container');

        // --- Top Nav ---
        const nav = container.createDiv('ctdp-nav');
        
        const taskSelect = new DropdownComponent(nav);
        taskSelect.selectEl.addClass('ctdp-task-select');
        const tasks = this.plugin.settings.tasks;
        if (tasks.length === 0) {
            taskSelect.addOption('none', this.plugin.tr("No Task Selected"));
            taskSelect.setValue('none');
        } else {
            tasks.forEach((t: CTDPTask) => taskSelect.addOption(t.id, t.name));
            if (this.plugin.settings.activeTaskId && tasks.find((t: CTDPTask) => t.id === this.plugin.settings.activeTaskId)) {
                taskSelect.setValue(this.plugin.settings.activeTaskId);
            } else if (tasks.length > 0) {
                 // Do not save settings here to avoid cycles
                 taskSelect.setValue(tasks[0].id);
            }
        }
        taskSelect.onChange(async (value) => {
            if (value !== 'none') {
                this.plugin.settings.activeTaskId = value;
                await this.plugin.saveSettings();
                this.render();
            }
        });

        const settingsBtn = nav.createEl('button', { cls: 'ctdp-nav-icon-btn' });
        setIcon(settingsBtn, 'settings');
        settingsBtn.onclick = () => {
            // @ts-ignore
            this.plugin.app.setting.open();
            // @ts-ignore
            this.plugin.app.setting.openTabById(this.plugin.manifest.id);
        };

        // --- Content ---
        const content = container.createDiv('ctdp-content');
        const activeTask = this.getActiveTask();

        if (!activeTask) {
            const empty = content.createDiv('ctdp-empty-state');
            empty.createEl('div', { text: '🎯', attr: { style: 'font-size: 3em; margin-bottom: 20px;' } });
            empty.createEl('h3', { text: this.plugin.tr("No Task Selected") });
            empty.createEl('p', { text: this.plugin.tr("Go to Settings") });
            return;
        }

        // --- v6 Vertical Layout Structure ---

        // 1. Top Section (Timer & Controls)
        const topSection = content.createDiv('ctdp-top-section');
        
        const timerContainer = topSection.createDiv('ctdp-timer-container');
        this.renderCircularTimer(timerContainer, 100, "00:00", activeTask.state);

        const controls = topSection.createDiv('ctdp-controls-area');
        this.renderControls(controls, activeTask);

        // 2. Stats Row (Left: Aux | Center: Main | Right: Prec)
        const statsRow = content.createDiv('ctdp-stats-row');

        // Aux (Left)
        const auxStat = statsRow.createDiv('ctdp-stat-group ctdp-side-stat');
        auxStat.createEl('div', { cls: 'ctdp-stat-val', text: activeTask.auxChainCount.toString() });
        auxStat.createEl('div', { cls: 'ctdp-stat-lbl', text: this.plugin.tr("Bookings") });

        // Main (Center)
        const mainStat = statsRow.createDiv('ctdp-stat-group ctdp-main-stat');
        mainStat.createEl('div', { cls: 'ctdp-stat-val', text: activeTask.mainChainCount.toString() });
        mainStat.createEl('div', { cls: 'ctdp-stat-lbl', text: this.plugin.tr("Main Chain") });

        // Precedents (Right)
        const precStat = statsRow.createDiv('ctdp-stat-group ctdp-side-stat');
        const pCount = activeTask.precedents.reduce((a, b) => a + b.usageCount, 0);
        precStat.createEl('div', { cls: 'ctdp-stat-val', text: pCount.toString() });
        precStat.createEl('div', { cls: 'ctdp-stat-lbl', text: this.plugin.tr("Precedents") });
    }

    renderControls(container: HTMLElement, task: CTDPTask) {
        if (task.state === 'IDLE') {
            const btn = container.createEl('button', { cls: 'ctdp-btn-icon ctdp-btn-start' });
            setIcon(btn, 'alarm-clock');
            btn.setAttribute('aria-label', this.plugin.tr("Book Session"));
            btn.onclick = async () => { await this.plugin.bookSession(task.id); };
        }
        else if (task.state === 'BOOKED') {
            const cancelBtn = container.createEl('button', { cls: 'ctdp-btn-icon ctdp-btn-danger' });
            setIcon(cancelBtn, 'x');
            cancelBtn.setAttribute('aria-label', this.plugin.tr("Cancel Booking"));
            cancelBtn.onclick = async () => {
                new ConfirmModal(this.plugin.app, this.plugin, this.plugin.tr("Cancel Booking"), this.plugin.tr("Reset Chain?"), this.plugin.tr("Reset All"), async () => {
                    await this.plugin.failChain(task.id);
                }).open();
            };

            const skipBtn = container.createEl('button', { cls: 'ctdp-btn-icon ctdp-btn-start' });
            setIcon(skipBtn, 'skip-forward');
            skipBtn.setAttribute('aria-label', this.plugin.tr("Skip Booking"));
            skipBtn.onclick = async () => { await this.plugin.startSession(task.id); };
        }
        else if (task.state === 'ACTIVE') {
            const stopBtn = container.createEl('button', { cls: 'ctdp-btn-icon ctdp-btn-danger' });
            setIcon(stopBtn, 'skull');
            stopBtn.setAttribute('aria-label', this.plugin.tr("Give Up"));
            stopBtn.onclick = async () => {
                new ConfirmModal(this.plugin.app, this.plugin, this.plugin.tr("Give Up"), this.plugin.tr("Reset Chain?"), this.plugin.tr("Reset All"), async () => {
                    await this.plugin.failChain(task.id);
                }).open();
            };

            const pauseBtn = container.createEl('button', { cls: 'ctdp-btn-icon ctdp-btn-secondary' });
            setIcon(pauseBtn, 'pause');
            pauseBtn.setAttribute('aria-label', this.plugin.tr("Pause"));
            pauseBtn.onclick = () => new PrecedentModal(this.plugin.app, this.plugin, task, async () => {}).open();
        }
        else if (task.state === 'PAUSED') {
            const resumeBtn = container.createEl('button', { cls: 'ctdp-btn-icon ctdp-btn-start' });
            setIcon(resumeBtn, 'play');
            resumeBtn.setAttribute('aria-label', this.plugin.tr("Resume"));
            resumeBtn.onclick = async () => { await this.plugin.resumeSession(task.id); };
        }
    }

    renderCircularTimer(container: HTMLElement, percent: number, text: string, label: string) {
        container.empty();
        const radius = 110;
        const stroke = 6;
        const normalizedRadius = radius - stroke * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (percent / 100) * circumference;
        let color = 'var(--interactive-accent)';
        if (label === 'PAUSED') color = 'var(--text-warning)';
        if (label === 'BOOKED') color = 'var(--text-muted)';

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("height", (radius * 2).toString());
        svg.setAttribute("width", (radius * 2).toString());
        
        const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bgCircle.setAttribute("stroke", "var(--background-modifier-border)");
        bgCircle.setAttribute("stroke-width", stroke.toString());
        bgCircle.setAttribute("fill", "transparent");
        bgCircle.setAttribute("r", normalizedRadius.toString());
        bgCircle.setAttribute("cx", radius.toString());
        bgCircle.setAttribute("cy", radius.toString());
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("stroke", color);
        circle.setAttribute("stroke-width", stroke.toString());
        circle.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
        circle.style.strokeDashoffset = strokeDashoffset.toString();
        circle.setAttribute("stroke-linecap", "round");
        circle.setAttribute("fill", "transparent");
        circle.setAttribute("r", normalizedRadius.toString());
        circle.setAttribute("cx", radius.toString());
        circle.setAttribute("cy", radius.toString());
        circle.classList.add('ctdp-progress-ring__circle');
        circle.id = 'ctdp-timer-circle-svg';

        svg.appendChild(bgCircle);
        svg.appendChild(circle);
        container.appendChild(svg);

        const contentDiv = container.createDiv('ctdp-timer-content');
        contentDiv.createEl('div', { cls: 'ctdp-timer-state', text: this.plugin.tr(label as LocaleKey) });
        contentDiv.createEl('div', { cls: 'ctdp-timer-time', text: text, attr: { id: 'ctdp-timer-text' } });
    }

    updateTimers() {
        const task = this.getActiveTask();
        if (!task) return; 
        
        const now = Date.now();
        let remaining = 0;
        let total = 1;
        
        if (task.state === 'BOOKED' && task.bookingStartTime) {
            const elapsed = now - task.bookingStartTime;
            total = task.bookingDuration * 60 * 1000;
            remaining = total - elapsed;
        } 
        else if (task.state === 'ACTIVE' && task.sessionStartTime) {
            const elapsed = now - task.sessionStartTime;
            total = task.sessionDuration * 60 * 1000;
            remaining = total - elapsed;
        }
        else if (task.state === 'PAUSED' && task.pauseStartTime && task.activePrecedentId) {
             const p = task.precedents.find(pr => pr.id === task.activePrecedentId);
             if (p) {
                 const elapsed = now - task.pauseStartTime;
                 total = p.autoFailMinutes * 60 * 1000;
                 remaining = total - elapsed;
             }
        }
        else if (task.state === 'IDLE') {
            remaining = task.bookingDuration * 60 * 1000;
            total = remaining;
        }

        if (remaining < 0) remaining = 0;
        const percent = (remaining / total) * 100;
        const timeStr = this.formatTime(remaining);

        const textEl = this.containerEl.querySelector('#ctdp-timer-text');
        if (textEl) textEl.textContent = timeStr;

        const circleEl = this.containerEl.querySelector('#ctdp-timer-circle-svg') as SVGElement;
        if (circleEl) {
             const radius = 110;
             const stroke = 6;
             const normalizedRadius = radius - stroke * 2;
             const circumference = normalizedRadius * 2 * Math.PI;
             const offset = circumference - (percent / 100) * circumference;
             circleEl.style.strokeDashoffset = offset.toString();
        }
    }

    formatTime(ms: number): string {
        const totalSeconds = Math.ceil(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}

class ConfirmModal extends Modal {
    plugin: CTDPPlugin;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;

    constructor(app: App, plugin: CTDPPlugin, title: string, message: string, confirmText: string, onConfirm: () => void) {
        super(app);
        this.plugin = plugin;
        this.title = title;
        this.message = message;
        this.confirmText = confirmText;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ctdp-modal-center-text');
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        const btnDiv = contentEl.createDiv('ctdp-modal-center-controls');
        new ButtonComponent(btnDiv).setButtonText(this.confirmText).setWarning().onClick(() => { this.onConfirm(); this.close(); });
        new ButtonComponent(btnDiv).setButtonText(this.plugin.tr("Cancel")).onClick(() => { this.close(); });
    }
    onClose() { this.contentEl.empty(); }
}

class PrecedentEditModal extends Modal {
    plugin: CTDPPlugin;
    task: CTDPTask;
    onSave: () => Promise<void>;

    constructor(app: App, plugin: CTDPPlugin, task: CTDPTask, onSave: () => Promise<void>) {
        super(app);
        this.plugin = plugin;
        this.task = task;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.plugin.tr("New Exception Rule") });

        const form = contentEl.createDiv('ctdp-form');
        let newName = ''; let newDesc = ''; let newTime = '5';
        new Setting(form).setName(this.plugin.tr("Name")).addText(t => t.setPlaceholder(this.plugin.tr("e.g. Bathroom")).onChange(v => newName = v));
        new Setting(form).setName(this.plugin.tr("Reason")).addText(t => t.setPlaceholder(this.plugin.tr("Why?")).onChange(v => newDesc = v));
        new Setting(form).setName(this.plugin.tr("Limit (mins)")).addText(t => t.setValue('5').onChange(v => newTime = v));

        const btnDiv = contentEl.createDiv('ctdp-modal-center-controls');
        new ButtonComponent(btnDiv).setButtonText(this.plugin.tr("Add Rule")).setCta().onClick(async () => {
             if(!newName) { new Notice(this.plugin.tr("Name required")); return; }
             const minutes = parseInt(newTime) || 5;
             const p: Precedent = { id: Date.now().toString(), name: newName, description: newDesc, autoFailMinutes: minutes, usageCount: 0 };
             this.task.precedents.push(p);
             await this.plugin.saveSettings();
             this.close();
             await this.onSave();
        });
        new ButtonComponent(btnDiv).setButtonText(this.plugin.tr("Cancel")).onClick(() => this.close());
    }
    onClose() { this.contentEl.empty(); }
}

class TaskModal extends Modal {
    plugin: CTDPPlugin;
    task: CTDPTask | null;
    onSubmit: () => Promise<void>;

    constructor(app: App, plugin: CTDPPlugin, task: CTDPTask | null, onSubmit: () => Promise<void>) {
        super(app);
        this.plugin = plugin;
        this.task = task;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.task ? this.plugin.tr("Edit Task") : this.plugin.tr("New Task") });

        let name = this.task?.name || '';
        let desc = this.task?.description || '';
        let sDur = this.task?.sessionDuration.toString() || '60';
        let bDur = this.task?.bookingDuration.toString() || '15';

        const form = contentEl.createDiv('ctdp-form');
        new Setting(form).setName(this.plugin.tr("Name")).addText(text => text.setValue(name).onChange(v => name = v));
        new Setting(form).setName(this.plugin.tr("Description")).addText(text => text.setValue(desc).onChange(v => desc = v));
        new Setting(form).setName(this.plugin.tr("Session Duration")).addText(text => text.setValue(sDur).onChange(v => sDur = v));
        new Setting(form).setName(this.plugin.tr("Booking Duration")).addText(text => text.setValue(bDur).onChange(v => bDur = v));

        if (this.task) {
            contentEl.createEl('h3', { text: this.plugin.tr("Manage Exceptions"), attr: { style: 'margin-top: 20px; border-bottom: 1px solid var(--background-modifier-border);' } });
            const pList = contentEl.createDiv('ctdp-precedent-list');
            this.renderPrecedents(pList);

            const addPBtn = contentEl.createDiv({ cls: 'ctdp-modal-center-controls', attr: { style: 'margin-top: 10px;' } });
            new ButtonComponent(addPBtn).setButtonText("+ " + this.plugin.tr("Add Rule")).onClick(() => {
                new PrecedentEditModal(this.plugin.app, this.plugin, this.task!, async () => {
                    pList.empty();
                    this.renderPrecedents(pList);
                }).open();
            });
        }

        const btnDiv = contentEl.createDiv('ctdp-modal-center-controls');
        btnDiv.style.marginTop = '30px';
        new ButtonComponent(btnDiv).setButtonText(this.plugin.tr("Save")).setCta().onClick(async () => {
            if (!name) { new Notice(this.plugin.tr("Name required")); return; }
            const sessionDur = parseInt(sDur);
            const bookingDur = parseInt(bDur);
            const validSessionDur = isNaN(sessionDur) ? 60 : sessionDur;
            const validBookingDur = isNaN(bookingDur) ? 15 : bookingDur;

            if (this.task) {
                this.task.name = name; this.task.description = desc; this.task.sessionDuration = validSessionDur; this.task.bookingDuration = validBookingDur;
            } else {
                const newTask: CTDPTask = {
                    id: Date.now().toString(), name, description: desc, sessionDuration: validSessionDur, bookingDuration: validBookingDur,
                    state: 'IDLE', mainChainCount: 0, auxChainCount: 0, bookingStartTime: null, sessionStartTime: null, pauseStartTime: null, activePrecedentId: null, precedents: [],
                    logBookingStartTime: null, logPrecedents: []
                };
                if (!this.plugin.settings.tasks) this.plugin.settings.tasks = [];
                this.plugin.settings.tasks.push(newTask);
                this.plugin.settings.activeTaskId = newTask.id;
            }
            await this.plugin.saveSettings();
            this.close();
            await this.onSubmit();
        });
    }

    renderPrecedents(container: HTMLElement) {
        if (!this.task || this.task.precedents.length === 0) {
            container.createEl('div', { text: this.plugin.tr("No exceptions defined"), attr: { style: 'padding: 10px; color: var(--text-muted); text-align: center;' } });
            return;
        }
        this.task.precedents.forEach((p, idx) => {
            const row = container.createDiv('ctdp-precedent-row');
            const details = row.createDiv('ctdp-precedent-details');
            details.createDiv({ cls: 'ctdp-precedent-row-name', text: p.name });
            details.createDiv({ cls: 'ctdp-precedent-row-meta', text: `${p.autoFailMinutes}m limit | Used: ${p.usageCount}` });
            
            const delBtn = row.createEl('button', { cls: 'ctdp-icon-action ctdp-icon-delete' });
            setIcon(delBtn, 'trash');
            delBtn.setAttribute('aria-label', this.plugin.tr("Delete rule"));
            delBtn.onclick = async () => {
                new ConfirmModal(this.plugin.app, this.plugin, this.plugin.tr("Delete rule"), `${this.plugin.tr("Delete rule")} "${p.name}"?`, this.plugin.tr("Delete"), async () => {
                    this.task!.precedents.splice(idx, 1);
                    await this.plugin.saveSettings();
                    container.empty();
                    this.renderPrecedents(container);
                }).open();
            };
        });
    }

    onClose() { this.contentEl.empty(); }
}

class PrecedentModal extends Modal {
    plugin: CTDPPlugin;
    task: CTDPTask;
    onSubmit: () => Promise<void>;

    constructor(app: App, plugin: CTDPPlugin, task: CTDPTask, onSubmit: () => Promise<void>) {
        super(app);
        this.plugin = plugin;
        this.task = task;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.plugin.tr("Interrupt Session") });
        contentEl.createEl('p', { text: this.plugin.tr("Select Exception") });

        const list = contentEl.createDiv('ctdp-precedent-selector');
        this.task.precedents.forEach(p => {
            const item = list.createDiv('ctdp-precedent-item');
            item.createEl('div', { cls: 'ctdp-precedent-name', text: p.name });
            item.createEl('div', { cls: 'ctdp-precedent-meta', text: `${p.autoFailMinutes}m limit | Used: ${p.usageCount}` });
            item.onclick = async () => {
                await this.plugin.pauseSession(this.task.id, p.id);
                this.close();
                await this.onSubmit();
            };
        });

        contentEl.createEl('h3', { text: this.plugin.tr("New Exception Rule"), attr: { style: 'margin-top: 20px;' } });
        const form = contentEl.createDiv('ctdp-form');
        let newName = ''; let newDesc = ''; let newTime = '5';
        new Setting(form).setName(this.plugin.tr("Name")).addText(t => t.setPlaceholder(this.plugin.tr("e.g. Bathroom")).onChange(v => newName = v));
        new Setting(form).setName(this.plugin.tr("Reason")).addText(t => t.setPlaceholder(this.plugin.tr("Why?")).onChange(v => newDesc = v));
        new Setting(form).setName(this.plugin.tr("Limit (mins)")).addText(t => t.setValue('5').onChange(v => newTime = v));

        const btnDiv = contentEl.createDiv('ctdp-modal-center-controls');
        new ButtonComponent(btnDiv).setButtonText(this.plugin.tr("Create & Use")).setCta().onClick(async () => {
             if(!newName) { new Notice(this.plugin.tr("Name required")); return; }
             const minutes = parseInt(newTime) || 5;
             const p: Precedent = { id: Date.now().toString(), name: newName, description: newDesc, autoFailMinutes: minutes, usageCount: 0 };
             this.task.precedents.push(p);
             await this.plugin.saveSettings();
             await this.plugin.pauseSession(this.task.id, p.id);
             this.close();
             await this.onSubmit();
        });
    }
    onClose() { this.contentEl.empty(); }
}

// --- Settings Tab ---

class CTDPSettingTab extends PluginSettingTab {
    plugin: CTDPPlugin;
    constructor(app: App, plugin: CTDPPlugin) { super(app, plugin); this.plugin = plugin; }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // 1. Task Management
        const taskHeaderContainer = containerEl.createDiv('ctdp-setting-header-container');
        taskHeaderContainer.createEl('h2', { text: this.plugin.tr("Task Chains"), cls: 'ctdp-setting-header-text' });
        new ButtonComponent(taskHeaderContainer).setButtonText("+ " + this.plugin.tr("New Task")).setCta().onClick(() => {
            new TaskModal(this.plugin.app, this.plugin, null, async () => { this.display(); this.plugin.refreshView(); }).open();
        });

        const taskList = containerEl.createDiv('ctdp-task-list');
        this.plugin.settings.tasks.forEach((task: CTDPTask) => {
            const item = taskList.createDiv('ctdp-task-item');
            
            const main = item.createDiv('ctdp-task-main');
            const headerRow = main.createDiv('ctdp-task-header-row');
            headerRow.createSpan({ cls: 'ctdp-task-name', text: task.name });
            if (task.description) headerRow.createSpan({ cls: 'ctdp-task-desc', text: task.description });
            
            main.createEl('div', { 
                cls: 'ctdp-task-stats',
                text: `${this.plugin.tr("Main Chain")}: ${task.mainChainCount} • ${this.plugin.tr("Bookings")}: ${task.auxChainCount} • ${this.plugin.tr("Exceptions")}: ${task.precedents.length}` 
            });

            const actions = item.createDiv('ctdp-task-actions');
            
            const editBtn = actions.createEl('button', { cls: 'ctdp-icon-action' });
            setIcon(editBtn, 'pencil');
            editBtn.setAttribute('aria-label', this.plugin.tr("Edit Task"));
            editBtn.onclick = () => {
                new TaskModal(this.plugin.app, this.plugin, task, async () => { this.display(); this.plugin.refreshView(); }).open();
            };

            const delBtn = actions.createEl('button', { cls: 'ctdp-icon-action ctdp-icon-delete' });
            setIcon(delBtn, 'trash');
            delBtn.setAttribute('aria-label', this.plugin.tr("Delete Task"));
            delBtn.onclick = () => {
                new ConfirmModal(this.plugin.app, this.plugin, this.plugin.tr("Delete Task"), `${this.plugin.tr("Delete")} "${task.name}"?`, this.plugin.tr("Delete"), async () => {
                    this.plugin.settings.tasks = this.plugin.settings.tasks.filter((t: CTDPTask) => t.id !== task.id);
                    if (this.plugin.settings.activeTaskId === task.id) {
                         this.plugin.settings.activeTaskId = this.plugin.settings.tasks.length > 0 ? this.plugin.settings.tasks[0].id : null;
                    }
                    await this.plugin.saveSettings();
                    this.display();
                    this.plugin.refreshView();
                }).open();
            };
        });

        // 2. General Settings
        const generalHeaderContainer = containerEl.createDiv('ctdp-setting-header-container');
        generalHeaderContainer.style.marginTop = '30px';
        generalHeaderContainer.createEl('h2', { text: this.plugin.tr("General"), cls: 'ctdp-setting-header-text' });
        
        new Setting(containerEl)
            .setName(this.plugin.tr("Language"))
            .addDropdown(d => d
                .addOption('system', this.plugin.tr("System Default"))
                .addOption('en', 'English')
                .addOption('zh', '简体中文')
                .setValue(this.plugin.settings.language)
                .onChange(async (v) => {
                    this.plugin.settings.language = v;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh settings UI text
                    this.plugin.refreshView(); // Refresh main view text
                }));

        new Setting(containerEl)
            .setName(this.plugin.tr("Enable System Notifications"))
            .setDesc(this.plugin.tr("Notifications Desc"))
            .addToggle(t => t.setValue(this.plugin.settings.enableNotifications).onChange(async (v) => {
            this.plugin.settings.enableNotifications = v; await this.plugin.saveSettings();
            if (v && Notification.permission !== 'granted') Notification.requestPermission();
        }));

        new Setting(containerEl)
            .setName(this.plugin.tr("Show Timer in Status Bar"))
            .addToggle(t => t.setValue(this.plugin.settings.enableStatusBarTimer).onChange(async (v) => {
                this.plugin.settings.enableStatusBarTimer = v;
                await this.plugin.saveSettings();
                if (!v && this.plugin.statusBarItem) this.plugin.statusBarItem.setText("");
            }));

        // 3. Logging Settings
        const loggingHeaderContainer = containerEl.createDiv('ctdp-setting-header-container');
        loggingHeaderContainer.style.marginTop = '30px';
        loggingHeaderContainer.createEl('h2', { text: this.plugin.tr("Daily Logging"), cls: 'ctdp-setting-header-text' });
        new ButtonComponent(loggingHeaderContainer).setButtonText(this.plugin.tr("Auto-detect")).onClick(async () => {
             try {
                 // @ts-ignore
                 const dailyNotesPlugin = this.plugin.app.internalPlugins.getPluginById("daily-notes");
                 if (dailyNotesPlugin && dailyNotesPlugin.instance && dailyNotesPlugin.instance.options) {
                     this.plugin.settings.dailyLogFormat = dailyNotesPlugin.instance.options.format || 'YYYY-MM-DD';
                     this.plugin.settings.dailyLogFolder = dailyNotesPlugin.instance.options.folder || '';
                     await this.plugin.saveSettings();
                     this.display();
                     new Notice(this.plugin.tr("Settings Updated"));
                 } else {
                     new Notice(this.plugin.tr("Daily Notes plugin not found or not configured"));
                 }
             } catch(e) { new Notice("Error detecting settings"); }
        });
        
        new Setting(containerEl)
            .setName(this.plugin.tr("Date Format"))
            .setDesc(this.plugin.tr("Format Desc"))
            .addText(t => t.setValue(this.plugin.settings.dailyLogFormat).onChange(async (v) => {
                this.plugin.settings.dailyLogFormat = v; await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName(this.plugin.tr("Daily Note Folder"))
            .setDesc(this.plugin.tr("Folder Desc"))
            .addText(t => t.setValue(this.plugin.settings.dailyLogFolder).onChange(async (v) => {
                this.plugin.settings.dailyLogFolder = v; await this.plugin.saveSettings();
            }));

        // 4. Danger Zone
        const dangerHeaderContainer = containerEl.createDiv('ctdp-setting-header-container');
        dangerHeaderContainer.style.marginTop = '30px';
        dangerHeaderContainer.createEl('h2', { text: this.plugin.tr("Danger Zone"), cls: 'ctdp-setting-header-text' });
        dangerHeaderContainer.style.color = 'var(--text-error)';
        
        new Setting(containerEl)
            .setName(this.plugin.tr("Reset All Settings"))
            .setDesc(this.plugin.tr("Reset Desc"))
            .addButton(b => b.setButtonText(this.plugin.tr("Reset")).setWarning().onClick(async () => {
                new ConfirmModal(this.plugin.app, this.plugin, this.plugin.tr("Reset All Settings"), this.plugin.tr("Reset Confirm Body"), this.plugin.tr("Reset"), async () => {
                     // @ts-ignore
                     this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
                     this.plugin.settings.tasks = [];
                     await this.plugin.saveSettings();
                     this.display();
                     this.plugin.refreshView();
                     new Notice("Settings Reset");
                }).open();
            }));
    }
}
