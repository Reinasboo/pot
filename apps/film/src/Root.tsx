import React from "react";
import { Composition } from "remotion";
import { Launch, ProductScreenshot } from "./film";

export const Root = () => <>
  <Composition id="Launch" component={Launch} durationInFrames={5400} fps={60} width={1920} height={1080} />
  {[0,1,2,3,4,5].map((variant) => <Composition key={variant} id={`ProductShot${variant+1}`} component={() => <ProductScreenshot variant={variant} />} durationInFrames={1} fps={60} width={1920} height={1080} />)}
</>;
