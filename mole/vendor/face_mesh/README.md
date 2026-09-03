# vendor/face_mesh

MediaPipe FaceMesh (`@mediapipe/face_mesh@0.4.1633559619`) — 사람두더지 메이커에서
사진의 얼굴 윤곽을 찾는 데 쓴다. `mole/js/face-detect.js` 가 처음 쓸 때 lazy-load.

SHELL(서비스워커 프리캐시)에는 **안** 넣는다 (약 10MB) — 메이커를 처음 여는
사람만 받도록 stale-while-revalidate 로 캐시.

## 다시 받기

```
npm install
cp node_modules/@mediapipe/face_mesh/{face_mesh.js,face_mesh.binarypb,\
face_mesh_solution_packed_assets.data,face_mesh_solution_packed_assets_loader.js,\
face_mesh_solution_simd_wasm_bin.js,face_mesh_solution_simd_wasm_bin.wasm,\
face_mesh_solution_simd_wasm_bin.data} mole/vendor/face_mesh/
```

non-SIMD wasm(`face_mesh_solution_wasm_bin.*`)은 용량 아끼려고 뺐다. 최신 브라우저는
전부 SIMD 지원.
