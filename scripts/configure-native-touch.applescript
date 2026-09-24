tell application id "com.apple.dt.Devices" to activate
delay 2
tell application "System Events"
    tell (first application process whose bundle identifier is "com.apple.dt.Devices")
        set entries to entire contents of menu bar 1
        repeat with entry in entries
            try
                if name of entry is "Simulate Hardware Keyboard" then
                    set mark to value of attribute "AXMenuItemMarkChar" of entry
                    if mark is not "" and mark is not missing value then click entry
                    return "Device Hub hardware keyboard disabled"
                end if
            end try
        end repeat
        error "Cannot locate Device Hub's Simulate Hardware Keyboard control"
    end tell
end tell
