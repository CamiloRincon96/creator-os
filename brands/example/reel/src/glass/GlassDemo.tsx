// A 7-second demo of the glass kit that renders with nothing but this project: the colored tiles and the dark
// gradient stand in for the person's own material only to show the motion. In a real piece every slot carries real
// material (their takes, their stock/, captures of their tools), as the standard asks.
//   npx remotion studio            → GlassDemo
//   npx remotion still GlassDemo out.png --frame=120
// With `world`, a photo or timelapse of your own (relative to public/) becomes the blurred world behind.
// It uses no `Logo`, so it renders without any file in public/logos/.
import { AbsoluteFill, Sequence } from "remotion";
import { ComeFromBehind } from "./ComeFromBehind";
import { FilmGrain } from "./FilmGrain";
import { World } from "./Glass";
import { ReelFeed } from "./ReelFeed";
import { Terminal, Typed } from "./Terminal";
import { BigWord, GlassPill, NumberWord } from "./Words";

export type GlassDemoProps = { world?: string };

export const GLASS_DEMO_FRAMES = 210;

export const GlassDemo = ({ world = "" }: GlassDemoProps) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Sequence durationInFrames={80} name="1 · number and the real command">
      <World src={world || undefined} />
      <NumberWord value={8} word="rules" at={4} y={300} count={[4, 22]} />
      <ComeFromBehind from={24} behind={{ x: 540, y: 1500 }} to={{ x: 540, y: 785 }}>
        {/* the command that really opens this project, in a pane the size of one line */}
        <Terminal y={690} h={190}>
          <Typed text="npx remotion studio" from={6} to={34} />
        </Terminal>
      </ComeFromBehind>
      <FilmGrain />
    </Sequence>
    <Sequence from={80} durationInFrames={92} name="2 · the feed where everything looks the same">
      <ReelFeed same={{ text: "WATCH THIS" }} />
    </Sequence>
    <Sequence from={172} name="3 · one word">
      <World src={world || undefined} />
      <BigWord at={2} y={660} size={150}>
        yours.
      </BigWord>
      <GlassPill at={12} text="same standard" top={960} size={72} />
      <FilmGrain />
    </Sequence>
  </AbsoluteFill>
);
