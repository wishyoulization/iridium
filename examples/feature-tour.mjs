// Builds dist/feature-tour.json: an Iridium notebook that exercises every
// feature. Run with `node examples/feature-tour.mjs`, then open dist/demo.html.
import { writeFileSync } from 'node:fs';

// [source, pinned]. Pinned cells show their code; unpinned show output only.
const cells = [
  [`md\`# Iridium feature tour

Every cell below is compiled and run by Observable's Notebook Kit. Edit any cell and press **Shift+Enter** (or ▶) to re-run it; cells that depend on it update automatically. **⌘S** saves. The pin icon on the left shows or hides a cell's code.\``, false],

  // Reactivity
  [`md\`## Values and reactivity\``, false],
  [`price = 12.5`, true],
  [`quantity = 4`, true],
  [`total = price * quantity`, true],
  [`md\`Total: **$\${total.toFixed(2)}** — change \\\`price\\\` or \\\`quantity\\\` above and re-run.\``, true],

  // Inspector
  [`md\`## Inspecting values\``, false],
  [`sample = ({
  name: "Iridium",
  tags: ["notebook", "observable"],
  nested: { depth: 2, ok: true },
  created: new Date(2024, 0, 1),
  lookup: new Map([["a", 1], ["b", 2]]),
  unique: new Set([1, 2, 3])
})`, true],
  [`function greet(who) {
  return \`Hello, \${who}!\`;
}`, true],
  [`greet("world")`, true],
  [`squares = Array.from({ length: 500 }, (_, i) => i * i)`, true],

  // Inputs
  [`md\`## Inputs and viewof\``, false],
  [`viewof radius = Inputs.range([5, 60], { value: 25, step: 1, label: "Radius" })`, true],
  [`viewof color = Inputs.select(["steelblue", "tomato", "seagreen", "goldenrod"], { label: "Color" })`, true],
  [`viewof name = Inputs.text({ label: "Name", value: "Observable" })`, true],
  [`viewof shapes = Inputs.checkbox(["circle", "square"], { label: "Shapes", value: ["circle", "square"] })`, true],
  [`svg\`<svg width=\${radius * 4 + 30} height=\${radius * 2 + 20}>
  \${shapes.includes("circle") ? svg\`<circle cx=\${radius + 10} cy=\${radius + 10} r=\${radius} fill=\${color}></circle>\` : ""}
  \${shapes.includes("square") ? svg\`<rect x=\${radius * 2 + 20} y=10 width=\${radius * 2} height=\${radius * 2} fill=\${color}></rect>\` : ""}
</svg>\``, true],
  [`html\`<p style="font-size: 1.4em">Hi <b style="color: \${color}">\${name}</b>, the radius is \${radius}.</p>\``, true],

  // mutable and buttons
  [`md\`## mutable and buttons\``, false],
  [`mutable clicks = 0`, true],
  [`viewof bump = Inputs.button("Increment clicks", { reduce: () => { mutable clicks++; } })`, true],
  [`viewof count = Inputs.button("Count", { value: 0, reduce: (n) => n + 1 })`, true],
  [`md\`\\\`clicks\\\` (mutable) is **\${clicks}**; the Count button's own value is **\${count}**.\``, true],

  // Generators
  [`md\`## Generators, time and animation\``, false],
  [`clock = {
  while (true) {
    yield new Date().toLocaleTimeString();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}`, true],
  [`start = Date.now()`, true],
  [`md\`This notebook has been open for **\${Math.floor((now - start) / 1000)}** seconds.\``, true],
  [`{
  const height = 120;
  const context = DOM.context2d(width, height);
  while (true) {
    const t = performance.now() / 1000;
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;
    for (let i = 0; i < 40; ++i) {
      context.beginPath();
      context.arc((i / 39) * (width - 20) + 10, height / 2 + Math.sin(t * 2 + i / 3) * 40, radius / 6, 0, 2 * Math.PI);
      context.fill();
    }
    yield context.canvas;
  }
}`, true],
  [`md\`The notebook is **\${width}px** wide — resize the window and the animation above follows.\``, true],

  // Charts
  [`md\`## Data and charts\``, false],
  [`viewof selected = Inputs.table(penguins, { rows: 8 })`, true],
  [`md\`\${selected.length} of \${penguins.length} penguins selected (tick rows in the table).\``, true],
  [`Plot.plot({
  width,
  grid: true,
  color: { legend: true },
  marks: [
    Plot.dot(selected.length ? selected : penguins, {
      x: "flipper_length_mm",
      y: "body_mass_g",
      stroke: "species",
      r: radius / 8
    })
  ]
})`, true],
  [`{
  const height = 160;
  const data = d3.range(60).map((i) => Math.sin(i / 4) * Math.cos(i / 11));
  const x = d3.scaleLinear([0, data.length - 1], [30, width - 10]);
  const y = d3.scaleLinear(d3.extent(data), [height - 20, 10]);
  const svg = d3.create("svg").attr("width", width).attr("height", height);
  svg.append("path")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .attr("d", d3.line((d, i) => x(i), y)(data));
  svg.append("g")
      .attr("transform", \`translate(0,\${height - 20})\`)
      .call(d3.axisBottom(x));
  return svg.node();
}`, true],

  // Libraries and markup
  [`md\`## Libraries and markup\``, false],
  [`_.chunk(["a", "b", "c", "d", "e"], 2)`, true],
  [`dayjs = import("dayjs").then((module) => module.default)`, true],
  [`dayjs().add(1, "week").format("dddd, MMMM D")`, true],
  [`d3array = require("d3-array@3")`, true],
  [`d3array.median([3, 1, 4, 1, 5, 9, 2, 6])`, true],
  [`tex\`E = mc^2 \\qquad \\int_0^1 x^2\\,dx = \\tfrac{1}{3}\``, true],
  [`dot\`digraph { rankdir=LR; node [shape=box]; Cell -> transpile -> define -> Inspector }\``, true],
  [`mermaid\`graph LR
  A[Edit cell] --> B[Shift+Enter]
  B --> C[Notebook Kit]
  C --> D[Dependents update]\``, true],

  // Imports from observablehq.com
  [`md\`## Importing from Observable

These cells import live code from notebooks on [observablehq.com](https://observablehq.com).\``, false],
  [`import {Legend, Swatches} from "@d3/color-legend"`, true],
  [`Legend(d3.scaleSequential([0, 100], d3.interpolateViridis), { title: "Temperature (°F)" })`, true],
  [`Swatches(d3.scaleOrdinal(["blueberries", "oranges", "apples"], d3.schemeCategory10))`, true],
  [`import {chart as alphabetChart} from "@d3/bar-chart/2"`, true],
  [`alphabetChart`, true],
  [`nameLetters = Array.from(
  d3.rollup(name.toUpperCase().replace(/[^A-Z]/g, ""), (v) => v.length, (d) => d),
  ([letter, count]) => ({ letter, frequency: count })
)`, true],
  [`import {chart as nameChart} with {nameLetters as data} from "@d3/bar-chart/2"`, true],
  [`md\`The same bar chart, with its \\\`data\\\` swapped for the letters in **\${name}** (edit the Name input above):\``, false],
  [`nameChart`, true],
  [`import {Scrubber} from "@mbostock/scrubber"`, true],
  [`viewof frame = Scrubber(d3.range(0, 101), { autoplay: false, loop: true, delay: 40 })`, true],
  [`html\`<div style="height: 14px; width: \${frame}%; background: \${color}; border-radius: 3px"></div>\``, true],
  [`import {slider} from "@jashkenas/inputs"`, true],
  [`viewof legacy = slider({ min: 0, max: 10, step: 0.5, value: 3, title: "A classic slider from @jashkenas/inputs" })`, true],
  [`legacy * 2`, true],
  [`import {chart as forceGraph} from "@d3/force-directed-graph/2"`, true],
  [`forceGraph`, true],

  // Plain JavaScript cells
  [`md\`## Plain JavaScript cells

Cells that aren't valid Observable JavaScript run as plain JavaScript, like Observable Notebooks 2.0: several statements, \\\`const\\\` declarations, standard imports, and \\\`display(…)\\\` to show output. Top-level declarations are available to other cells.\``, false],
  [`import {sum, mean} from "npm:d3-array";

const scores = [72, 88, 95, 61, 84];
const average = mean(scores);

display(\`Total \${sum(scores)}, average \${average.toFixed(1)}\`);`, true],
  [`md\`Other cells can use them: the best score is **\${Math.max(...scores)}** and the average is **\${average}**.\``, true],
  [`import confetti from "https://esm.sh/canvas-confetti@1";

const button = html\`<button>Celebrate 🎉</button>\`;
button.onclick = () => confetti({ particleCount: 120, spread: 70 });
display(button);`, true],
  [`const label = \`\${name} picked \${color}\`;

for (const size of [12, 18, 24]) {
  display(html\`<span style="font-size: \${size}px; color: \${color}; margin-right: 8px">\${label}</span>\`);
}`, true],
  [`class Counter {
  #count = 0;
  increment() { return ++this.#count; }
}

const counter = new Counter();
counter.increment();
display(counter.increment());`, true],

  // Async and errors
  [`md\`## Async values and errors\``, false],
  [`slow = new Promise((resolve) => setTimeout(() => resolve("Resolved after 2 seconds"), 2000))`, true],
  [`brokenReference = notDefinedAnywhere + 1`, true],
  [`{
  throw new Error("Thrown on purpose");
}`, true],
  [`oops = (1 +`, true],
];

const notebook = cells.map(([sourceCode, pin], i) => ({ id: i + 1, pin, sourceCode }));
writeFileSync(new URL('../dist/feature-tour.json', import.meta.url), JSON.stringify(notebook, null, 2) + '\n');
console.log(`wrote dist/feature-tour.json (${notebook.length} cells)`);
