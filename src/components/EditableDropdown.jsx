import { useState, useEffect, useRef } from "react";

export default function EditableDropdown({
  value,
  options,
  onChange,
  className,
  unit,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="custom-combobox-container" ref={containerRef}>
      <div className="input-unit-wrapper">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className={`hybrid-combobox-input ${className}`}
        />
        <button
          type="button"
          className="combobox-arrow-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          ▼
        </button>
        {unit && <span className="outside-unit-label">{unit}</span>}
      </div>

      {isOpen && (
        <ul className="combobox-options-list">
          {options.map((option) => (
            <li
              key={option}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className="combobox-option-item"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
