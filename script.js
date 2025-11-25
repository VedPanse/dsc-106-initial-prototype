// NDVI Greening Trends — research-grade interactive visualization
const svg = d3.select("#linechart");
const tooltip = d3.select("#tooltip");

const colorScale = d3
  .scaleOrdinal()
  .domain(["High income", "Upper-middle income", "Lower-middle income"])
  .range(["#007aff", "#2dd1ac", "#f9c00c"]);

const order = ["High income", "Upper-middle income", "Lower-middle income"];
let dataset = [];

// Load real data
d3.csv("ndvi_income_year.csv", d => ({
  year: +d.year,
  income: d.income_group, // source column is named income_group
  ndvi_pct_change: +d.ndvi_pct_change
})).then(data => {
  dataset = data;
  render();
  window.addEventListener("resize", () => {
    svg.selectAll("*").remove();
    render();
  });
});

// Main render function (responsive)
const render = () => {
  if (!dataset.length) return;

  const { width, height } = svg.node().getBoundingClientRect();
  const margin = { top: 90, right: 175, bottom: 70, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3
    .scaleLinear()
    .domain(d3.extent(dataset, d => d.year))
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([
      d3.min(dataset, d => d.ndvi_pct_change) - 1,
      d3.max(dataset, d => d.ndvi_pct_change) + 1
    ])
    .nice()
    .range([innerHeight, 0]);

  const line = d3
    .line()
    .x(d => x(d.year))
    .y(d => y(d.ndvi_pct_change))
    .curve(d3.curveMonotoneX);

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const dataByIncome = d3.group(dataset, d => d.income);
  const dataByYear = d3.group(dataset, d => d.year);
  const groups = Array.from(dataByIncome.entries()).filter(([key]) =>
    order.includes(key)
  );

  const visibility = new Map(order.map(key => [key, true]));
  const pathSelections = new Map();
  const dotSelections = new Map();

  // Title + subtitle inside SVG
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 32)
    .attr("fill", "#111")
    .attr("font-size", 22)
    .attr("font-weight", 700)
    .text("NDVI Greening Trends by Global Income Group (2000–2024)");

  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 54)
    .attr("fill", "#444")
    .attr("font-size", 16)
    .text("Percent change relative to 2000–2005 baseline");

  // GWGI ribbon (inequality region)
  const gwgiData = Array.from(dataByYear, ([year, values]) => {
    const maxVal = d3.max(values, d => d.ndvi_pct_change);
    const minVal = d3.min(values, d => d.ndvi_pct_change);
    return { year: +year, maxVal, minVal, mid: (maxVal + minVal) / 2 };
  }).sort((a, b) => d3.ascending(a.year, b.year));

  chart
    .append("path")
    .datum(gwgiData)
    .attr("fill", "#888")
    .attr("opacity", 0.15)
    .attr(
      "d",
      d3
        .area()
        .x(d => x(d.year))
        .y0(d => y(d.minVal))
        .y1(d => y(d.maxVal))
    );

  const lastGwgi = gwgiData[gwgiData.length - 1];
  if (lastGwgi) {
    chart
      .append("text")
      .attr("x", x(lastGwgi.year) - 6)
      .attr("y", y(lastGwgi.mid))
      .attr("fill", "#555")
      .attr("font-size", 12)
      .attr("text-anchor", "end")
      .text("Greening Wealth Gap Index (GWGI)");
  }

  // Axes
  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  chart.append("g").call(d3.axisLeft(y));

  // Axis labels
  chart
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 50)
    .attr("text-anchor", "middle")
    .attr("fill", "#111")
    .attr("font-size", 14)
    .text("Year");

  chart
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .attr("fill", "#111")
    .attr("font-size", 14)
    .text("NDVI Percent Change (%)");

  // Paris Agreement marker
  const parisX = x(2015);
  chart
    .append("line")
    .attr("x1", parisX)
    .attr("x2", parisX)
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#cc79a7")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5");

  chart
    .append("text")
    .attr("x", parisX + 6)
    .attr("y", 14)
    .attr("fill", "#cc79a7")
    .attr("font-size", 12)
    .text("Paris Agreement (2015)");

  // Lines + animation
  const lineGroup = chart.append("g").attr("class", "lines");
  groups.forEach(([income, values]) => {
    const sorted = values.slice().sort((a, b) => d3.ascending(a.year, b.year));
    const path = lineGroup
      .append("path")
      .datum(sorted)
      .attr("fill", "none")
      .attr("stroke", colorScale(income))
      .attr("stroke-width", 3)
      .attr("opacity", 1)
      .attr("d", line);

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    pathSelections.set(income, path);
  });

  // Tracking dots
  const dotGroup = chart.append("g").attr("class", "hover-dots");
  order.forEach(income => {
    const circle = dotGroup
      .append("circle")
      .attr("r", 6)
      .attr("fill", colorScale(income))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0);
    dotSelections.set(income, circle);
  });

  // Vertical hover guideline
  const hoverLine = chart
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#111")
    .attr("stroke-width", 1.2)
    .attr("stroke-dasharray", "4,4")
    .attr("opacity", 0);

  // Legend with toggle interaction
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + innerWidth + 20},${margin.top})`
    );

  const legendItems = legend
    .selectAll(".legend-item")
    .data(order)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (_, i) => `translate(0, ${i * 24})`)
    .style("cursor", "pointer")
    .on("click", (_, key) => {
      const current = visibility.get(key);
      visibility.set(key, !current);

      const lineSel = pathSelections.get(key);
      lineSel
        .transition()
        .duration(250)
        .attr("opacity", visibility.get(key) ? 1 : 0.12);

      legendSquares
        .filter(d => d === key)
        .transition()
        .duration(200)
        .attr("opacity", visibility.get(key) ? 1 : 0.3);

      dotSelections.get(key).attr("opacity", 0);
      tooltip.style("opacity", 0);
      hoverLine.attr("opacity", 0);
    });

  const legendSquares = legendItems
    .append("rect")
    .attr("width", 14)
    .attr("height", 14)
    .attr("rx", 2)
    .attr("fill", d => colorScale(d))
    .attr("opacity", 1);

  legendItems
    .append("text")
    .attr("x", 20)
    .attr("y", 11)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .text(d => d);

  // Tooltip styling (black box)
  tooltip
    .style("position", "absolute")
    .style("background", "#000")
    .style("color", "#fff")
    .style("padding", "10px 12px")
    .style("border-radius", "8px")
    .style("font-size", "14px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // Mouse leave handler
  const handleMouseLeave = () => {
    hoverLine.transition().duration(150).attr("opacity", 0);
    dotSelections.forEach(circle =>
      circle.transition().duration(120).attr("opacity", 0)
    );
    tooltip.transition().duration(120).style("opacity", 0);
  };

  // Interaction overlay for hover
  chart
    .append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event);
      const yearScale = x.invert(mx);
      const closestYear = Math.round(yearScale);

      if (
        closestYear < x.domain()[0] ||
        closestYear > x.domain()[1]
      ) {
        handleMouseLeave();
        return;
      }

      hoverLine
        .attr("x1", x(closestYear))
        .attr("x2", x(closestYear))
        .transition()
        .duration(100)
        .attr("opacity", 0.7);

      const rows = [];
      order.forEach(income => {
        if (!visibility.get(income)) return;
        const values = dataByIncome.get(income);
        const point = values?.find(d => d.year === closestYear);
        if (!point) return;

        dotSelections
          .get(income)
          .attr("cx", x(point.year))
          .attr("cy", y(point.ndvi_pct_change))
          .transition()
          .duration(120)
          .attr("opacity", 1);

        rows.push({
          income,
          value: point.ndvi_pct_change,
          color: colorScale(income)
        });
      });

      if (!rows.length) {
        handleMouseLeave();
        return;
      }

      const rowsHtml = rows
        .map(
          r =>
            `<div><span style="color:${r.color}">●</span> ${r.income}: <b>${r.value.toFixed(
              2
            )}%</b></div>`
        )
        .join("");

      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY + 14}px`)
        .html(`<div><strong>${closestYear}</strong></div>${rowsHtml}`);
    })
    .on("mouseleave", () => handleMouseLeave());
};
