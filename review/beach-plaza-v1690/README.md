LATEST: cloud hippo removed at user request; gulls retained. Ocean now uses linear perspective, derivative-based distant wave filtering, restrained reflection and a five-render-pixel horizon alpha transition. Weapon launch horizon and shoreline retained. CPU water-reference.png is an offline calculation, NOT a browser screenshot. Supersedes older hippo-retention/fog notes below.

# V1690 local beach/plaza work (not deployed)

Public release remains V1689 G, commit 87400a40c1876df2655d8b97eb980426322d77fe, Pages run 43187446140 succeeded.

Authorized changes:
- Sand mole hole from built-in ImageGen, with original source and exact prompt under assets/rhythm/beach-sand-hole-v1690. Earlier stone assets retained.
- Ocean uses the plaza's identical three displacement waves, six normal waves, palette, Fresnel reflection and specular equations. Projection and shore-distance mapping are adapted to the straight 2D beach. A cloudless CSS sky covers the old image sky; existing sand remains. Gull/hippo motion code retained.
- Ocean draws from the existing audio clock at up to 30 fps, capped render width 800 pixels / DPR1.25. No independent animation loop or network wait. Static fallback on unsupported WebGL2; context restoration supported.
- Dark rim seam: instead of fading the character above an already faded DOM foreground (double exposure of the dark opening), compose the same foreground sand RGB directly into the character edge. Hands retain their existing foreground exception.
- Shop/rhythm sign board meshes removed. Transparent, high resolution, sharp text textures; rhythm uses the existing shader colour/brightness animation without blurred glow; Korean shop reads `상 점` with a 20% larger relative font. Other signs remain unchanged.
- Ground height is -0.3 on the plaza beach, matching the existing sand cylinder. Standing, walking, takeoff and landing use the same height.
- Ocean falls sink below the animated water surface and return to the central intro hole after 1.4 seconds. Existing one-heart penalty remains; no duplicate penalty or mid-sink flap input.

Verification:
- verify-beach-plaza-v1690: all non-board plaza geometry retained; exactly 376 board triangles removed. Sign texture transparency, wave constants, audio clock, pause, resize and context restore; old hippo/gull functions equal to baseline. Alpha-compositing seam calculation.
- verify-beach-ground-water-v1690: ground height, walking/takeoff, sinking progression, one-time heart penalty, input guard and centre return.
- Existing home3d layout/state/intro/input/signs/sea and rhythm exit/prewarm/live-wipe checks passed.
- verify-live-appearances: real GLBs, 4 appearances, palm positions and all 858 SHELL assets passed. Beach placement and sand layer checks passed.

Browser visuals, actual shader execution and phone frame rate have NOT been verified. No browser/app launched. Latest changed style/controller cache/query =1690-beach-local-7, official release label unchanged. No commit/push/deployment authorized for this additional work.

Regenerate plaza: Blender 5.2 CLI `-b -P review/build-home-plaza.py`. The `plaza-before.glb` backup and `rhythm-beach-before.js` snapshot are for regression comparison. Unrelated dirty review files are preserved.

Deferred user discussions: target-identification marks in the mole game (user will consider); extra game/new island choice (discussion only). Do not implement either without further direction.

Latest correction supersedes the hippo-midpoint interpretation: use the existing weapon launch horizon L.horizonY (stage height * .37), translated by stage.offsetTop, as the exact ocean top. No weapon-route changes. Preserve moving waves at the horizon by limiting far fog to .65. Results show immediately while water pauses instead of hiding. Trim only 3 source pixels from the dark inner-lip contact contour; back/source unchanged. See verify-rhythm-result-horizon-v1690.cjs.
