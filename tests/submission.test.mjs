import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inspectSubmission, loadSubmission } from '../tools/submission.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'relay-package-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  const put = (name, text) => writeFileSync(join(root, name), text);
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Fixture');
  };
  try {
    git('init');
    put(
      'dreamweaver.json',
      JSON.stringify({
        protocol: 'dreamweaver.v4',
        runtime: 'node24',
        entrypoint: 'bot.ts',
        name: 'Fixture',
      }),
    );
    put('package.json', '{}');
    put('package-lock.json', '{}');
    put('bot.ts', 'throw Error("The packaging check must never execute the agent");');
    commit();
    run({ root, git, put, commit });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('submission receipt identifies the committed archive and leaves edits untouched', () =>
  fixture(({ root, git, put, commit }) => {
    const initial = inspectSubmission('HEAD', root);
    git('tag', 'practice-v1');
    put('bot.ts', 'changed working file');
    const loaded = loadSubmission('practice-v1', root);
    assert.equal(loaded.receipt.sha, initial.sha);
    assert.equal(loaded.receipt.uncommittedChanges, true);
    assert.equal(loaded.receipt.archiveSha256, createHash('sha256').update(loaded.archive).digest('hex'));
    assert.equal(loaded.receipt.archiveSha256, initial.archiveSha256);
    assert.equal(readFileSync(join(root, 'bot.ts'), 'utf8'), 'changed working file');
    commit();
    assert.notEqual(inspectSubmission('HEAD', root).archiveSha256, initial.archiveSha256);
    assert.equal(inspectSubmission('practice-v1', root).archiveSha256, initial.archiveSha256);
  }));

test('export-ignore cannot silently remove a required Node file', () => {
  for (const required of ['dreamweaver.json', 'bot.ts', 'package.json', 'package-lock.json']) {
    fixture(({ root, put, commit }) => {
      put('.gitattributes', `${required} export-ignore\n`);
      commit();
      assert.throws(
        () => inspectSubmission('HEAD', root),
        new RegExp('Archive omits ' + required.replaceAll('.', '\\.')),
      );
    });
  }
});

test('Python requirements must also survive archive export', () =>
  fixture(({ root, put, commit }) => {
    put(
      'dreamweaver.json',
      JSON.stringify({
        protocol: 'dreamweaver.v4',
        runtime: 'python312',
        entrypoint: 'bot.py',
        name: 'Python fixture',
      }),
    );
    put('bot.py', 'raise RuntimeError("must not execute")');
    put('requirements.txt', '');
    put('.gitattributes', 'requirements.txt export-ignore\n');
    commit();
    assert.throws(() => inspectSubmission('HEAD', root), /Archive omits requirements.txt/);
  }));

test('optional archive exclusions and nested entrypoints remain supported', () =>
  fixture(({ root, put, commit }) => {
    mkdirSync(join(root, 'src'));
    put('src/agent.ts', 'throw Error("must not execute")');
    put(
      'dreamweaver.json',
      JSON.stringify({
        protocol: 'dreamweaver.v4',
        runtime: 'node24',
        entrypoint: 'src/agent.ts',
        name: 'Nested fixture',
      }),
    );
    put('notes.md', 'not needed during play');
    put('.gitattributes', 'notes.md export-ignore\n');
    commit();
    assert.equal(inspectSubmission('HEAD', root).manifest.entrypoint, 'src/agent.ts');
    assert.throws(() => inspectSubmission('HEAD', join(root, 'src')), /repository root/);
  }));

test('ambiguous committed paths are rejected before archive listing', () =>
  fixture(({ root, put, commit }) => {
    put('misleading\tname.ts', '');
    commit();
    assert.throws(() => inspectSubmission('HEAD', root), /Unsupported path/);
  }));
