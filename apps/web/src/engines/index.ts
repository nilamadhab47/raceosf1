export { CoordMapper, lerp, lerpScalar, dist, ghostSmooth } from "./CoordMapper";
export type { Point, BBox, PathSample, MapperConfig } from "./CoordMapper";

export { animationLoop, CarInterpolator } from "./AnimationLoop";
export type { FrameCallback, CarAnimState } from "./AnimationLoop";

export { DataStream } from "./DataStream";
export type { RaceFrame, StreamCallback } from "./DataStream";

export { useTimeline, SPEED_OPTIONS } from "./Timeline";
export type { TimelineState } from "./Timeline";

export { useEventEngine } from "./EventEngine";
export type { RaceEvent, RaceEventType, EventClip, EventSeverity, EventEngineState } from "./EventEngine";

export { useCamera, computeTransform } from "./CameraEngine";
export type { CameraMode, CameraState, CameraTransform } from "./CameraEngine";

export { Director, director } from "./DirectorEngine";
export type { DirectorCommand } from "./DirectorEngine";

export { useReplayEngine, REPLAY_SPEED_OPTIONS } from "./ReplayEngine";
export type { ReplayFrame, ReplayEngineState } from "./ReplayEngine";
