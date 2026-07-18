import Svg, { Path, Rect } from "react-native-svg";
import { useAccentColor } from "@/theme/useAccentColor";

interface WharfMarkProps {
  readonly size?: number;
}

// The wharf brand mark (mock 01/02): an accent chevron over a short pier bar,
// drawn on a 1024 viewBox so it scales cleanly to any `size`. Colour tracks the
// live accent. This is the sanctioned brand-mark exception to the lucide-only
// icon rule (REACT.md). No emissive drop-shadow: the RN 0.86 `filter` style is
// disallowed and a box-shaped glow would not follow the glyph outline.
export function WharfMark({ size = 46 }: WharfMarkProps) {
  const accent = useAccentColor();

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path
        d="M300 336 L508 512 L300 688"
        stroke={accent}
        strokeWidth={96}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x={556} y={620} width={168} height={72} rx={24} fill={accent} />
    </Svg>
  );
}
