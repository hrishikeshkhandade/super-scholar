import { AbsoluteFill, Img, staticFile } from "remotion";
import { NES, PIXEL_FONT, pixelOutline } from "../theme";

// The part of the boss-fight frame shown: the scholar facing Sir Forget-a-Lot,
// zoomed 1.5x, below the sky (which has a stray mouse cursor in the recording)
// and above most of the dirt.
const CROP = { x: 340, y: 498, width: 1280 };
const SOURCE = { width: 1920, height: 1080 };
const TITLE_HEIGHT = 312;

// The YouTube thumbnail: the game's title over its boss fight. Rendered as a
// still with `npm run thumbnail`; the black sky of the frame runs into the
// black behind the title, so the two read as one picture.
export const Thumbnail: React.FC = () => {
  const zoom = SOURCE.width / CROP.width;

  return (
    <AbsoluteFill name="Thumbnail" style={{ backgroundColor: NES.black }}>
      <div
        style={{
          position: "absolute",
          top: TITLE_HEIGHT,
          left: 0,
          width: SOURCE.width,
          height: SOURCE.height - TITLE_HEIGHT,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("stills/boss-arena.png")}
          style={{
            position: "absolute",
            width: SOURCE.width * zoom,
            height: SOURCE.height * zoom,
            left: -CROP.x * zoom,
            top: -CROP.y * zoom,
            imageRendering: "pixelated",
          }}
        />
      </div>

      <AbsoluteFill
        style={{
          height: TITLE_HEIGHT + 60,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 40,
        }}
      >
        <div
          style={{
            fontFamily: PIXEL_FONT,
            fontSize: 130,
            color: NES.yellow,
            textShadow: pixelOutline(9),
          }}
        >
          SUPER SCHOLAR
        </div>
        <div
          style={{
            marginTop: 44,
            fontFamily: PIXEL_FONT,
            fontSize: 52,
            color: NES.white,
            textShadow: pixelOutline(5),
          }}
        >
          TURN ANY PAPER INTO A GAME
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
