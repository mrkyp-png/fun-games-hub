'use strict';
const assert = require('assert');
require('fake-indexeddb/auto');

// 최소 localStorage 폴리필 (Node)
if (typeof localStorage === 'undefined') {
  const mem = {};
  global.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
}

const { FaceStore } = require('../js/face-store.js');

function fakeBlob(tag) {
  return new Blob([tag], { type: 'image/png' });
}

(async function run() {
  const id1 = await FaceStore.saveFace(fakeBlob('a'), '엄마');
  await new Promise((r) => setTimeout(r, 5));
  const id2 = await FaceStore.saveFace(fakeBlob('b'), '아빠');
  assert.notStrictEqual(id1, id2, 'id 유일');

  const list = await FaceStore.listFaces();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, id2, '최신이 먼저 (createdAt desc)');
  assert.strictEqual(list[0].name, '아빠');

  FaceStore.setActive(id1);
  assert.strictEqual(FaceStore.getActiveId(), id1);

  await FaceStore.renameFace(id1, '어머니');
  assert.strictEqual((await FaceStore.getFace(id1)).name, '어머니');

  await FaceStore.deleteFace(id1);
  assert.strictEqual(await FaceStore.getFace(id1), null);
  assert.strictEqual(FaceStore.getActiveId(), null, '활성 얼굴 삭제 시 활성 해제');
  assert.strictEqual((await FaceStore.listFaces()).length, 1);

  // 20개 상한
  for (let i = 0; i < 19; i++) await FaceStore.saveFace(fakeBlob('x' + i), 'f' + i);
  assert.strictEqual(await FaceStore.count(), 20);
  await assert.rejects(FaceStore.saveFace(fakeBlob('over'), 'over'), /full/, '21번째 거부');

  console.log('test-face-store: OK');
})().catch((e) => { console.error(e); process.exit(1); });
