import { PersonStanding } from "lucide-react";
import absIcon from "../assets/fitness/abs.png";
import armsIcon from "../assets/fitness/arms.png";
import backIcon from "../assets/fitness/back.png";
import cardioIcon from "../assets/fitness/cardio.png";
import chestIcon from "../assets/fitness/chest.png";
import legsIcon from "../assets/fitness/legs.png";
import shouldersIcon from "../assets/fitness/shoulders.png";
import type { BodyPart } from "../types";

const BODY_PART_IMAGES: Record<BodyPart, string | null> = {
  胸部: chestIcon,
  背部: backIcon,
  腿部: legsIcon,
  肩部: shouldersIcon,
  手臂: armsIcon,
  核心: absIcon,
  有氧: cardioIcon,
  全身: null,
};

export function BodyPartIcon({ bodyPart, size, fitContainer = false, className = "" }: {
  bodyPart: BodyPart;
  size: number;
  fitContainer?: boolean;
  className?: string;
}) {
  const src = BODY_PART_IMAGES[bodyPart];
  const dimensions = fitContainer
    ? { width: "100%", height: "auto", maxWidth: size, aspectRatio: "1 / 1" }
    : { width: size, height: size };

  if (!src) return <PersonStanding size={size} style={dimensions} className={`shrink-0 ${className}`} aria-hidden="true" />;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={dimensions}
      className={`shrink-0 object-contain ${className}`}
      decoding="async"
    />
  );
}
