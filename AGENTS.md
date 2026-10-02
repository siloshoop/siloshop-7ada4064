# Project architecture rules

- Keep intentionally wide comparison content inside its own horizontal scroller; never allow it to widen the document viewport, because Android WebViews clip document-level overflow unpredictably in RTL.