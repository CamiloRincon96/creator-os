import { Composition } from "remotion";
import { calculateExplainer, Explainer } from "./explainer/Explainer";
import { GLASS_DEMO_FRAMES, GlassDemo } from "./glass/GlassDemo";
import { calculateTest, PersonTest } from "./kit/PersonTest";
import { calculateHook, HookText } from "./kit/HookText";
import { calculateMockup, Mockup, type MockupProps } from "./mockup/Mockup";

const EMPTY_MOCKUP: MockupProps = { folder: "", fps: 30, duration: 30, voice: "", cut_video: "", scenes: [], phrases: [], words: [] };

// The brand's reels (1080 × 1920, 30 fps). Each new piece is registered here as a composition.
export const Root = () => (
  <>
    {/* The express reel from a voice note (production/tools/note.py). */}
    <Composition id="Explainer" component={Explainer} calculateMetadata={calculateExplainer} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{ data: "pieces/example/explainer.json" }} />
    {/* The gray mockup from stage 5 of /creator-reel. */}
    <Composition id="Mockup" component={Mockup} defaultProps={EMPTY_MOCKUP} calculateMetadata={calculateMockup} durationInFrames={30} fps={30} width={1080} height={1920} />
    {/* Test of the person with text behind their head (stage 6). */}
    <Composition id="PersonTest" component={PersonTest} defaultProps={{ src: "", front: "" }} calculateMetadata={calculateTest} durationInFrames={165} fps={30} width={1080} height={1920} />
    {/* Hook text with a transparent background (variations). */}
    <Composition id="HookText" component={HookText} defaultProps={{ text: "Your *hook* line", seconds: 2.5 }} calculateMetadata={calculateHook} durationInFrames={75} fps={30} width={1080} height={1920} />
    {/* The «glass» kit in motion, with no footage (src/glass/README.md). Public repo only: keep it when re-translating. */}
    <Composition id="GlassDemo" component={GlassDemo} defaultProps={{ world: "" }} durationInFrames={GLASS_DEMO_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
