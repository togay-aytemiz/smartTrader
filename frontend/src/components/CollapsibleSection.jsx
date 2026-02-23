import React, { useState } from 'react';

export default function CollapsibleSection({ title, children, defaultOpen = true, extraHeader }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`st-collapsible-section ${isOpen ? 'open' : 'closed'}`}>
            <div
                className="st-collapsible-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="st-collapsible-title-row">
                    <span
                        className="material-symbols-outlined st-collapsible-chevron"
                        style={{ transform: `rotate(${isOpen ? '90deg' : '0deg'})` }}
                    >
                        chevron_right
                    </span>
                    <h3 className="st-sidebar-title" style={{ margin: 0, border: 'none', padding: 0 }}>
                        {title}
                    </h3>
                </div>
                {extraHeader && (
                    <div className="st-collapsible-extra" onClick={(e) => e.stopPropagation()}>
                        {extraHeader}
                    </div>
                )}
            </div>

            <div
                className="st-collapsible-content"
                style={{
                    display: isOpen ? 'block' : 'none',
                    paddingTop: isOpen ? '16px' : '0'
                }}
            >
                {children}
            </div>
        </div>
    );
}
