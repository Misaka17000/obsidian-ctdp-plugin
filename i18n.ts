// i18n.ts

const en = {
    // General
    "CTDP Dashboard": "CTDP Dashboard",
    "No Task Selected": "No Task Selected",
    "Go to Settings": "Go to Settings to create tasks.",

    // Stats
    "Main Chain": "Main Chain",
    "Bookings": "Bookings",
    "Precedents": "Precedents",
    "Exceptions": "Exceptions",

    // Timer States
    "READY": "READY",
    "IDLE": "IDLE",
    "BOOKED": "BOOKED",
    "ACTIVE": "ACTIVE",
    "PAUSED": "PAUSED",

    // Controls
    "Book Session": "Book Session",
    "Cancel Booking": "Cancel Booking",
    "Start Session": "Start Session",
    "Skip Booking": "Skip Booking",
    "Give Up": "Give Up",
    "Pause": "Pause",
    "Resume": "Resume",

    // Modals & Confirmations
    "Reset Chain?": "This will reset chain counts and delete all exception rules. Continue?",
    "Reset All": "Reset All",
    "Cancel": "Cancel",
    "Delete Task": "Delete Task",
    "Delete": "Delete",
    "Edit Task": "Edit Task",
    "New Task": "New Task",
    "Name": "Name",
    "Description": "Description",
    "Session Duration": "Session Duration (mins)",
    "Booking Duration": "Booking Duration (mins)",
    "Save": "Save",
    "Name required": "Name required",

    // Precedents
    "Interrupt Session": "Interrupt Session",
    "Select Exception": "Select an allowed precedent to pause.",
    "New Exception Rule": "New Exception Rule",
    "Add Rule": "Add Rule",
    "Create & Use": "Create & Use",
    "Reason": "Reason",
    "Limit (mins)": "Limit (mins)",
    "No exceptions defined": "No exceptions defined.",
    "Manage Exceptions": "Manage Exceptions",
    "Delete rule": "Delete rule",
    "e.g. Bathroom": "e.g. Bathroom",
    "Why?": "Why?",

    // Settings
    "Task Chains": "Task Chains",
    "Manage chains": "Manage your different chains here.",
    "General": "General",
    "Language": "Language",
    "System Default": "System Default",
    "Enable System Notifications": "Enable System Notifications",
    "Notifications Desc": "Show desktop notifications for events.",
    "Daily Logging": "Daily Logging",
    "Date Format": "Date Format",
    "Format Desc": "e.g. YYYY-MM-DD",
    "Daily Note Folder": "Daily Note Folder",
    "Folder Desc": "Path to your daily notes folder.",
    "Auto-detect": "Auto-detect from Daily Notes Plugin",
    "Settings Updated": "Settings Updated",
    "Daily Notes plugin not found or not configured": "Daily Notes plugin not found or not configured",
    "Show Timer in Status Bar": "Show Timer in Status Bar",
    "Danger Zone": "Danger Zone",
    "Reset All Settings": "Reset All Settings",
    "Reset Desc": "WARNING: This will delete all your tasks and chains.",
    "Reset Confirm Body": "Are you sure you want to reset everything? This cannot be undone.",
    "Reset": "Reset",

    // Notifications
    "Sacred Seat Started!": "Sacred Seat Started!",
    "Session Started Body": "Time's up! Session for \"{0}\" started.",
    "Session Complete!": "Session Complete!",
    "Session Complete Body": "+1 Node for \"{0}\".",
    "Pause Limit Exceeded!": "Pause Limit Exceeded!",
    "Pause Limit Body": "Too long on break for \"{0}\". Chain Reset.",
    "Logged to Daily Note": "Logged to Daily Note"
};

const zh = {
    // General
    "CTDP Dashboard": "CTDP 控制台",
    "No Task Selected": "未选择任务",
    "Go to Settings": "请前往设置创建任务。",

    // Stats
    "Main Chain": "主链节点",
    "Bookings": "预约次数",
    "Precedents": "例外次数",
    "Exceptions": "例外规则",

    // Timer States
    "READY": "就绪",
    "IDLE": "空闲",
    "BOOKED": "已预约",
    "ACTIVE": "专注中",
    "PAUSED": "暂停中",

    // Controls
    "Book Session": "预约专注",
    "Cancel Booking": "取消预约",
    "Start Session": "开始专注",
    "Skip Booking": "跳过预约",
    "Give Up": "放弃/重置",
    "Pause": "暂停",
    "Resume": "恢复",

    // Modals & Confirmations
    "Reset Chain?": "这将重置链计数并删除所有例外规则。确定继续吗？",
    "Reset All": "重置所有",
    "Cancel": "取消",
    "Delete Task": "删除任务",
    "Delete": "删除",
    "Edit Task": "编辑任务",
    "New Task": "新建任务",
    "Name": "名称",
    "Description": "描述",
    "Session Duration": "专注时长 (分钟)",
    "Booking Duration": "预约时长 (分钟)",
    "Save": "保存",
    "Name required": "请输入名称",

    // Precedents
    "Interrupt Session": "中断专注",
    "Select Exception": "选择一个「下必为例」规则以暂停。",
    "New Exception Rule": "新建「下必为例」规则",
    "Add Rule": "添加规则",
    "Create & Use": "创建并使用",
    "Reason": "理由",
    "Limit (mins)": "时限 (分钟)",
    "No exceptions defined": "暂无例外规则。",
    "Manage Exceptions": "管理例外规则",
    "Delete rule": "删除规则",
    "e.g. Bathroom": "例如：上厕所",
    "Why?": "原因？",

    // Settings
    "Task Chains": "任务链管理",
    "Manage chains": "在这里管理你的不同任务链。",
    "General": "通用设置",
    "Language": "语言 (Language)",
    "System Default": "跟随系统",
    "Enable System Notifications": "开启系统通知",
    "Notifications Desc": "在桌面显示完成或失败的通知。",
    "Daily Logging": "日记记录",
    "Date Format": "日期格式",
    "Format Desc": "例如：YYYY-MM-DD 或 YYYY年MM月DD日",
    "Daily Note Folder": "日记文件夹",
    "Folder Desc": "每日日记所在的文件夹路径。",
    "Auto-detect": "从「日记」插件自动获取配置",
    "Settings Updated": "设置已更新",
    "Daily Notes plugin not found or not configured": "未找到「日记」插件或其未配置",
    "Show Timer in Status Bar": "在底部状态栏显示倒计时",
    "Danger Zone": "危险区域",
    "Reset All Settings": "重置所有设置",
    "Reset Desc": "警告：这将删除您的所有任务和记录。",
    "Reset Confirm Body": "您确定要重置所有数据吗？此操作无法撤销。",
    "Reset": "重置",

    // Notifications
    "Sacred Seat Started!": "神圣座位已开启！",
    "Session Started Body": "时间到！「{0}」专注时段自动开始。",
    "Session Complete!": "专注完成！",
    "Session Complete Body": "「{0}」主链节点 +1。",
    "Pause Limit Exceeded!": "休息超时！",
    "Pause Limit Body": "「{0}」休息时间过长，任务链已断裂。",
    "Logged to Daily Note": "已记录到每日日记"
};

export const resources = {
    en,
    zh
};

export type LangType = keyof typeof resources;
export type LocaleKey = keyof typeof en;

export function t(key: LocaleKey, lang: string = 'en'): string {
    let dict = resources.en;
    if (lang === 'zh') dict = resources.zh;

    return dict[key] || resources.en[key] || key;
}
