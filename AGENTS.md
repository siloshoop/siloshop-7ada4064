# Project architecture rules

- Keep intentionally wide comparison content inside its own horizontal scroller; never allow it to widen the document viewport, because Android WebViews clip document-level overflow unpredictably in RTL.
- Route every user-facing share through src/lib/share.ts and every file export through src/lib/exportFile.ts; they guarantee public production URLs and native (Capacitor Share/Filesystem) handling.
