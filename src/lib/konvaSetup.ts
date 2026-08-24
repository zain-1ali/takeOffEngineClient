/**
 * Ensure full Konva shape constructors are registered.
 * Vite can sometimes load a partial Konva graph; side-effect imports
 * make Line/Rect/Ellipse/Text available to react-konva.
 */
import "konva/lib/shapes/Line";
import "konva/lib/shapes/Rect";
import "konva/lib/shapes/Ellipse";
import "konva/lib/shapes/Circle";
import "konva/lib/shapes/Text";
import "konva/lib/shapes/Path";
