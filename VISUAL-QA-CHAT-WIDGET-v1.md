# Visual QA — Floating Chat Widget

The source preview was opened at the homepage and the floating AI launcher was visible in the lower-right corner. Clicking the launcher opened the existing Balkan Agent AI panel in the same lower-right position. The panel displayed the BA avatar, online label, quick-question buttons, input field and send control. The panel did not obscure the primary hero content at the tested viewport. The launcher is implemented as an accessible button and the open panel uses dialog semantics with a polite chat log.

The widget is an AI support/demo flow backed by `/api/bot/chat` with local FAQ fallback and team handover messaging; it is not presented as a falsely staffed human live-chat service.

## Interaction check

The opened widget accepted the test question “Koliko košta Premium paket?” and rendered the relevant package/pricing fallback response inside the scrollable chat log. The input, quick actions and send control remained visible after the response. No browser error was observed in this interaction check.

## Close and responsive checks

After closing the panel, the launcher returned to the lower-right corner and the panel became hidden. The DOM check reported `launcherHidden: false`, `widgetHidden: true`, `widgetDisplay: none`, and a constrained panel width suitable for the viewport. The close/open behavior therefore leaves the page usable and does not trap the visitor in the chat interface.

## Final refresh check

After a fresh homepage load, the launcher remained visible in the lower-right corner. Opening it displayed the quick-question controls, chat input and the direct translated handover link `Podrška → Kontakt`. The final preview therefore confirms the widget is discoverable, usable and connected to a human-contact path without claiming that a human operator is continuously online.
