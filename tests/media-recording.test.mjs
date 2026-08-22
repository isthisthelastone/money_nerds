import assert from "node:assert/strict";
import test from "node:test";
import {
  recordingConstraintCandidates,
  recordingErrorMessage,
  recordingFileExtension,
  recorderMimeCandidates,
  requestRecordingStream,
  resolveRecordedMimeType,
} from "../src/lib/media/recording.ts";

function fakeStream({ audio = true, video = false } = {}) {
  const track = () => ({ readyState: "live", stop() {} });
  const audioTracks = audio ? [track()] : [];
  const videoTracks = video ? [track()] : [];
  return {
    getAudioTracks: () => audioTracks,
    getVideoTracks: () => videoTracks,
    getTracks: () => [...audioTracks, ...videoTracks],
  };
}

test("selected devices fall back from exact to ideal and then defaults", () => {
  const candidates = recordingConstraintCandidates("video_circle", {
    audioDeviceId: "mic-2",
    videoDeviceId: "camera-back",
  });

  assert.deepEqual(candidates[0].audio.deviceId, { exact: "mic-2" });
  assert.deepEqual(candidates[0].video.deviceId, { exact: "camera-back" });
  assert.deepEqual(candidates[1].audio.deviceId, { ideal: "mic-2" });
  assert.deepEqual(candidates[1].video.deviceId, { ideal: "camera-back" });
  assert.deepEqual(candidates.at(-1), { audio: true, video: true });
});

test("constraint failures retry without retrying permission denial", async () => {
  let calls = 0;
  const recovered = await requestRecordingStream(
    {
      async getUserMedia() {
        calls += 1;
        if (calls === 1) throw new DOMException("stale device", "OverconstrainedError");
        return fakeStream({ audio: true });
      },
    },
    "audio",
    { audioDeviceId: "stale-mic" },
  );
  assert.equal(calls, 2);
  assert.equal(recovered.getAudioTracks().length, 1);

  calls = 0;
  await assert.rejects(
    requestRecordingStream(
      {
        async getUserMedia() {
          calls += 1;
          throw new DOMException("denied", "NotAllowedError");
        },
      },
      "audio",
      { audioDeviceId: "mic" },
    ),
    { name: "NotAllowedError" },
  );
  assert.equal(calls, 1);
});

test("container bytes override unreliable recorder MIME declarations", async () => {
  const mp4Header = new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x6d, 0x70, 0x34, 0x32,
  ]);
  const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01]);

  assert.equal(
    await resolveRecordedMimeType("audio", [new Blob([mp4Header], { type: "audio/webm" })], "audio/webm"),
    "audio/mp4",
  );
  assert.equal(
    await resolveRecordedMimeType("video_circle", [new Blob([webmHeader])], ""),
    "video/webm",
  );
  assert.equal(recordingFileExtension("audio", "audio/mp4"), "m4a");
  assert.equal(recordingFileExtension("video_circle", "video/mp4"), "mp4");
});

test("Safari-safe MP4 is preferred and a prior grant is not reported as denial", () => {
  assert.match(recorderMimeCandidates("audio")[0], /^audio\/mp4/);
  assert.match(recorderMimeCandidates("video_circle")[0], /^video\/mp4/);

  const denied = new DOMException("denied", "NotAllowedError");
  assert.match(recordingErrorMessage(denied, "audio", false), /^Allow microphone access/);
  assert.match(
    recordingErrorMessage(denied, "audio", true),
    /could not reopen the microphone after access was granted/,
  );
});
