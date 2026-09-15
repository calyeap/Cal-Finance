// scripts/evidence/archive.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);

/**
 * Zips the capture directory.
 *
 * Shells out to a platform archiver rather than an archiver dependency: one
 * is present on every platform this runs on, and the archive is a delivery
 * detail rather than something worth adding a package for. `zip` (present on
 * Linux and macOS) is run with the capture directory as cwd so the archive's
 * root is the directory's *contents*, matching Compress-Archive's
 * `-Path 'dir\*'` behaviour: unzipping either archive produces the same flat
 * layout, not a wrapper folder.
 */
export async function zipDirectory(dir: string, zipPath: string): Promise<void> {
  const absoluteZipPath = path.resolve(zipPath);
  if (process.platform === "win32") {
    await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      // -ErrorAction Stop: without it Compress-Archive reports some failures
      // non-terminatingly and powershell.exe still exits 0, so a failed
      // packaging step would look like a successful one to execFile.
      `Compress-Archive -Path '${dir}\\*' -DestinationPath '${absoluteZipPath}' -Force -ErrorAction Stop`,
    ]);
    return;
  }
  // No shell involved (execFile), so no quoting/injection concerns here.
  // zip exits non-zero on failure, which promisified execFile turns into a
  // rejection — no PowerShell-style silent-failure risk to guard against.
  await run("zip", ["-r", "-q", absoluteZipPath, "."], { cwd: dir });
}
