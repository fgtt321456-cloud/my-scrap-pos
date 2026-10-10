using System;
using System.Collections.Generic;

namespace ThaiRail.UI
{
    /// <summary>One line of a HUD modal: title, detail and up to three buttons. Content is rebuilt while the modal is open.</summary>
    public sealed class ModalRow
    {
        public string title, sub, badge;
        public bool highlight;
        public readonly List<ModalButton> buttons = new List<ModalButton>(3);
        public ModalRow Button(string label, bool enabled, Action onClick, bool primary = false) { buttons.Add(new ModalButton { label = label, enabled = enabled, onClick = onClick, primary = primary }); return this; }
    }
    public sealed class ModalButton { public string label; public bool enabled, primary; public Action onClick; }
}
