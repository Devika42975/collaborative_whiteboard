function Toolbar({
  selectedTool,
  color,
  brushSize,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onClear,
}) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Whiteboard tools">
      <button
        type="button"
        className={selectedTool === 'pen' ? 'tool-btn active' : 'tool-btn'}
        onClick={() => onToolChange('pen')}
      >
        Pen
      </button>

      <button
        type="button"
        className={selectedTool === 'eraser' ? 'tool-btn active' : 'tool-btn'}
        onClick={() => onToolChange('eraser')}
      >
        Eraser
      </button>

      <label className="toolbar-control">
        Color
        <input
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
          aria-label="Pick pen color"
        />
      </label>

      <label className="toolbar-control">
        Brush Size: {brushSize}px
        <input
          type="range"
          min="1"
          max="30"
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          aria-label="Adjust brush size"
        />
      </label>

      <button type="button" className="tool-btn clear" onClick={onClear}>
        Clear Board
      </button>
    </div>
  )
}

export default Toolbar