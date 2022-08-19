const vite = require('vite')
const legacyPlugin = require("@vitejs/plugin-legacy");
const fs = require("fs");
const path = require("path");

const getTsxFiles = (src) => {
  let files = [];
  fs.readdirSync(src).forEach(i => {
    if (i.toLowerCase() === '.ds_store') return;
    const filepath = `${src}/${i}`;
    if (fs.statSync(filepath).isDirectory()) {
      files = [...files, ...getTsxFiles(filepath)];
    } else if (path.extname(filepath) === '.tsx') {
      files.push(filepath);
    }
  });
  return files;
};

const rmDir = (dir = '' || []) => {
  if (typeof dir === "string") {
    dir = [dir]
  }

  let t = 0

  return new Promise(resolve => {
    const s = () => ++t === dir.length && resolve(t)
    dir.forEach(i => fs.existsSync(i) ? fs.rm(i, {recursive: true}, s) : s())
  })
}

const remove = (src = '' || [], tar) => {
  if (typeof src === "string") {
    src = [src]
  }

  for (const s of src) {
    if (!fs.existsSync(s)) {
      continue
    }

    for (const out of fs.readdirSync(s)) {
      fs.renameSync(`${s}/${out}`, `${tar}/${out}`)
    }
  }
}

const main = async () => {
  const projectDir = path.resolve(__dirname.replace('/build', ''))

  const files = getTsxFiles(`${projectDir}/src/pages`)
  if (!files.length) return;
  console.log(files.map(i => i.replace(projectDir, '')))

  const htmlTemplate = fs.readFileSync(`${projectDir}/index.html`, 'utf8')
  const tsxTemplate = fs.readFileSync(`${projectDir}/src/main.tsx`, 'utf8')

  await rmDir([`${projectDir}/dist`, `${projectDir}/.template`])


  let task = 0;

  await new Promise(resolve => {
    const success = () => ++task === files.length && resolve(task)

    for (const file of files) {
      const tsxPath = `${projectDir}/.template/${file.replace(`${projectDir}/src/pages/`, '').toLowerCase()}`
      const htmlPath = tsxPath.replace('.tsx', '.html')

      const htmlContent = htmlTemplate
        .replace('/src/main.tsx', `./${path.basename(tsxPath)}`)
        .replace(/<title>(.*)<\/title>/g, '<title>页面标题</title>')
      const tsxContent = tsxTemplate
        .replace('<React.StrictMode>', '<React.StrictMode><App />')
        .replace('ReactDOM.createRoot',
          `import App from '${file.replace(`${projectDir}/src`, '@').replace('.tsx', '')}'\nReactDOM.createRoot`)

      !fs.existsSync(path.dirname(tsxPath)) && fs.mkdirSync(path.dirname(tsxPath), {recursive: true})

      fs.writeFileSync(tsxPath, tsxContent)
      fs.writeFileSync(htmlPath, htmlContent)

      const entry = htmlPath
        .replace(`${projectDir}/.template/`, '')
        .replace(/\//g, '_')
        .replace('.html', '')

      vite.build({
        plugins: [legacyPlugin({targets: ['safari 10']})],
        build: {
          rollupOptions: {
            input: {[entry]: htmlPath}
          },
          emptyOutDir: false,
        }
      }).then(success)
    }
  })

  await remove([`${projectDir}/dist/.template`, `${projectDir}/dist/index`], `${projectDir}/dist`)

  await rmDir([`${projectDir}/dist/.template`, `${projectDir}/dist/index`, `${projectDir}/.template`])
}

main()