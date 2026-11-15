// Stage 6 test: one block of the person with the kit's treatment, to compare before and after.
// Taken as a still: npx remotion still PersonTest out.png --props=... --frame=N
import type { CalculateMetadataFunction } from "remotion";
import { C, fontFamily } from "../brand";
import { Person } from "./Person";

export type PersonTestProps = { src: string; front: string; word?: string; frames?: number };

export const calculateTest: CalculateMetadataFunction<PersonTestProps> = ({ props }) => ({ durationInFrames: props.frames ?? 165 });

export const PersonTest = ({ src, front, word }: PersonTestProps) =>
  src ? (
    <Person
      src={src}
      front={front}
      behind={
        word ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 215,
              textAlign: "center",
              fontFamily,
              fontWeight: 800,
              fontSize: 230,
              letterSpacing: "-0.04em",
              color: C.mint,
              textShadow: "0 20px 60px rgb(0 0 0 / 0.45)",
            }}
          >
            {word}
          </div>
        ) : null
      }
    />
  ) : null;
