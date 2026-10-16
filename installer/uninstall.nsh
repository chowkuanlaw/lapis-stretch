; Lapis uninstaller (1.11.0): ask before deleting the user's data.
; Never asks during an update (the old version is removed silently then), and a silent
; uninstall keeps the data (/SD IDNO). Lapis keeps everything in %APPDATA%\Lapis.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also remove your Lapis data from this PC?$\r$\n(your stretch and water history, collected kuih and settings)$\r$\n$\r$\nPadam juga data Lapis anda dari PC ini?$\r$\n(sejarah regangan dan air, kuih yang dikumpul dan tetapan)$\r$\n$\r$\nChoose No to keep it in case you install Lapis again." /SD IDNO IDNO lapis_keep_data
      SetShellVarContext current
      ${if} "$APPDATA" != ""            ; never remove a bare "\Lapis" if the folder can't be resolved
        RMDir /r "$APPDATA\Lapis"
      ${endIf}
    lapis_keep_data:
  ${endIf}
!macroend
