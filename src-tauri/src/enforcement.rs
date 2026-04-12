use std::collections::HashSet;
use std::sync::Mutex;
use sysinfo::{ProcessesToUpdate, System};

const SYSTEM_PROCS: &[&str] = &[
    "WindowServer",
    "kernel_task",
    "launchd",
    "loginwindow",
    "distnoted",
    "coreservicesd",
    "syslogd",
    "configd",
    "mds",
    "mds_stores",
    "mdworker",
    "mdworker_shared",
    "msessiond",
    "fseventsd",
    "delete_vorgs",
    "sharingd",
    "ubd",
    "ClamAV",
    "Sandbox",
    "parsec-r",
    "hidd",
    "warmd",
    "CommCenter",
    "accountsd",
    "locationd",
    "lsd",
    "imagent",
    "studentd",
    "DuetHeur",
    "diskarbitrationd",
    "notifyd",
    "coresymbolicationd",
    "analyticsd",
    "nsurlsessiond",
    "nsurlstoraged",
    "submitdiag",
    "cloudpaird",
    "cloudd",
    "AddressBookS",
    "imdpersistencea",
    "languageassetd",
    "ReportCrash",
    "diagnosticd",
    "com.apple.nsd",
    "rtcreportingd",
    "kbd",
    "logd",
    "symptomsd",
    "wifid",
    "apsd",
    "mobileassetd",
    "softwareupdated",
    "mds_stores",
    "soagent",
    "Screenshotsync",
    "AppSSODaemon",
    "SiriNCService",
    "proactived",
    "wisard",
    "rapportd",
    "biomesyncd",
    "BookLibrary",
    "UserEventAgent",
    "Spotlight",
    "ControlCenter",
    "ScreenshotService",
    "Dock",
    "Finder",
    "SystemUIServer",
    "WindowManager",
    "WallpaperVideoExtension",
    "Notes",
    "Block Writer",
    "block-writer",
];

pub struct EnforcementState {
    pub baseline_pids: HashSet<u32>,
    sys: Mutex<System>,
}

impl EnforcementState {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let mut baseline = HashSet::new();
        for (pid, _) in sys.processes() {
            baseline.insert(pid.as_u32());
        }

        EnforcementState {
            baseline_pids: baseline,
            sys: Mutex::new(sys),
        }
    }

    pub fn enforce(&self, self_pid: u32) -> Vec<String> {
        let mut sys = match self.sys.lock() {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };

        sys.refresh_processes(ProcessesToUpdate::All, false);

        let mut killed = Vec::new();

        for (pid, process) in sys.processes() {
            let pid_u32 = pid.as_u32();

            if self.baseline_pids.contains(&pid_u32) {
                continue;
            }

            if pid_u32 == self_pid {
                continue;
            }

            let name = process.name().to_string_lossy().to_string();

            if SYSTEM_PROCS.iter().any(|s| name.contains(s)) {
                continue;
            }

            if process.kill() {
                killed.push(name);
            }
        }

        killed
    }
}
