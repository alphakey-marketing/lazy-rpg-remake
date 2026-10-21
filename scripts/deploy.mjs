// Build web, push dist/ to gh-pages branch. GitHub Pages serve it.
import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const run = (cmd, cwd = ".") => execSync(cmd, { stdio: "inherit", cwd });
const url = execSync("git remote get-url origin").toString().trim();

run("npm run build");
writeFileSync("dist/.nojekyll", "");
rmSync("dist/.git", { recursive: true, force: true });
run("git init -q -b gh-pages", "dist");
run("git add -A", "dist");
run('git commit -qm "Deploy web build"', "dist");
run(`git push -f ${url} gh-pages`, "dist");
rmSync("dist/.git", { recursive: true, force: true });
console.log("Done → https://alphakey-marketing.github.io/lazy-rpg-remake/ (wait ~1 min)");
