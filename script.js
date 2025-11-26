// NDVI Greening Trends — fully interactive showcase visualization
const svg = d3.select("#linechart");
const tooltip = d3.select("#tooltip");

const incomeOrder = ["High income", "Upper-middle income", "Lower-middle income"];
const colorMap = {
  "High income": "#007aff",
  "Upper-middle income": "#2dd1ac",
  "Lower-middle income": "#f9c00c"
};

let dataset = [];
let visibilityState = new Map(incomeOrder.map(key => [key, true]));

// Load CSV data with strict parsing
d3.csv("ndvi_income_year.csv", d => ({
  year: +d.year,
  ndvi_pct_change: +d.ndvi_pct_change,
  income_group: d.income_group
})).then(data => {
  dataset = data.filter(
    d =>
      Number.isFinite(d.year) &&
      Number.isFinite(d.ndvi_pct_change) &&
      incomeOrder.includes(d.income_group)
  );
  initTooltip();
  render();
  window.addEventListener("resize", () => {
    svg.selectAll("*").remove();
    render();
  });
});

// Tooltip base styling
const initTooltip = () => {
  tooltip
    .style("position", "absolute")
    .style("background", "#111")
    .style("color", "#fff")
    .style("padding", "12px 14px")
    .style("border-radius", "10px")
    .style("box-shadow", "0 12px 30px rgba(0,0,0,0.28)")
    .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif")
    .style("font-size", "14px")
    .style("pointer-events", "none")
    .style("opacity", 0);
};

// Main responsive render function
const render = () => {
  if (!dataset.length) return;
  svg.selectAll("*").remove();

  const measured = svg.node().getBoundingClientRect();
  const width = measured.width || 960;
  const height = measured.height || 540;
  const margin = { top: 90, right: 240, bottom: 70, left: 90 };
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);

  svg
    .attr("width", width)
    .attr("height", height)
    .attr("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif")
    .attr("font-size", 12);

  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Title and subtitle
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 32)
    .attr("fill", "#0f172a")
    .attr("font-size", 22)
    .attr("font-weight", 700)
    .text("NDVI Greening Trends by Global Income Group (2000–2024)");

  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 54)
    .attr("fill", "#4b5563")
    .attr("font-size", 15)
    .text("Percent change relative to the 2000–2005 baseline");

  // Scales
  const xDomain = [2000, 2024];
  const x = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);

  const yExtent = d3.extent(dataset, d => d.ndvi_pct_change);
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 2;
  const y = d3
    .scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .nice()
    .range([innerHeight, 0]);

  // Background gridlines for readability
  chart
    .append("g")
    .attr("class", "gridlines")
    .call(
      d3
        .axisLeft(y)
        .ticks(8)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .call(g => g.selectAll("line").attr("stroke", "#0f172a").attr("stroke-opacity", 0.08))
    .call(g => g.select(".domain").remove());

  // GWGI ribbon computation
  const gwgiData = d3
    .rollups(
      dataset,
      v => ({
        max: d3.max(v, d => d.ndvi_pct_change),
        min: d3.min(v, d => d.ndvi_pct_change)
      }),
      d => d.year
    )
    .map(([year, stats]) => ({
      year: +year,
      max: stats.max,
      min: stats.min,
      mid: (stats.max + stats.min) / 2
    }))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const area = d3
    .area()
    .x(d => x(d.year))
    .y0(d => y(d.min))
    .y1(d => y(d.max));

  chart
    .append("path")
    .datum(gwgiData)
    .attr("fill", "#888")
    .attr("opacity", 0.15)
    .attr("d", area);

  const gwgiLast = gwgiData[gwgiData.length - 1];
  if (gwgiLast) {
    chart
      .append("text")
      .attr("x", Math.min(x(gwgiLast.year) + 8, innerWidth - 4))
      .attr("y", y(gwgiLast.mid))
      .attr("fill", "#4b5563")
      .attr("font-size", 12)
      .attr("dominant-baseline", "middle")
      .text("Greening Wealth Gap Index (GWGI)");
  }

  // Axes
  const xAxis = d3.axisBottom(x).ticks(8).tickFormat(d3.format("d"));
  const yAxis = d3.axisLeft(y).ticks(8);

  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .call(g => g.selectAll(".domain").attr("stroke", "#111"))
    .call(g => g.selectAll("text").attr("fill", "#111").attr("font-size", 12));

  chart
    .append("g")
    .call(yAxis)
    .call(g => g.selectAll(".domain").attr("stroke", "#111"))
    .call(g => g.selectAll("text").attr("fill", "#111").attr("font-size", 12));

  // Axis labels
  chart
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 48)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("text-anchor", "middle")
    .text("Year");

  chart
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -58)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("text-anchor", "middle")
    .text("NDVI Percent Change (%)");

  // Paris Agreement annotation
  const parisX = x(2015);
  chart
    .append("line")
    .attr("x1", parisX)
    .attr("x2", parisX)
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#cc79a7")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6,6");

  chart
    .append("text")
    .attr("x", Math.min(parisX + 8, innerWidth - 4))
    .attr("y", 14)
    .attr("fill", "#cc79a7")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("Paris Agreement (2015)");

  // Data prep by income group and lookup by year
  const groupedByIncome = d3.group(dataset, d => d.income_group);
  const valueLookup = new Map(incomeOrder.map(key => [key, new Map()]));
  dataset.forEach(d => {
    valueLookup.get(d.income_group)?.set(d.year, d.ndvi_pct_change);
  });

  const lineGenerator = d3
    .line()
    .x(d => x(d.year))
    .y(d => y(d.ndvi_pct_change))
    .curve(d3.curveMonotoneX);

  const lineSelections = new Map();
  const legendSquares = new Map();
  const dotSelections = new Map();
  let hoveredSeries = null;

  const updateLineEmphasis = () => {
    incomeOrder.forEach(key => {
      const visible = visibilityState.get(key);
      const path = lineSelections.get(key);
      const legendRect = legendSquares.get(key);
      const baseOpacity = visible ? 1 : 0.15;
      const finalOpacity =
        hoveredSeries && visible ? (hoveredSeries === key ? 1 : 0.2) : baseOpacity;
      path?.attr("opacity", finalOpacity);
      legendRect?.attr("opacity", visible ? (hoveredSeries && hoveredSeries !== key ? 0.45 : 1) : 0.3);
    });
  };

  // Interaction hitbox for hover tracking
  chart
    .append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent");

  // Draw lines with animation
  const lineGroup = chart.append("g").attr("class", "lines");
  incomeOrder.forEach(key => {
    const values = (groupedByIncome.get(key) || []).slice().sort((a, b) => d3.ascending(a.year, b.year));
    const path = lineGroup
      .append("path")
      .datum(values)
      .attr("fill", "none")
      .attr("stroke", colorMap[key])
      .attr("stroke-width", 3)
      .attr("opacity", visibilityState.get(key) ? 1 : 0.15)
      .attr("d", lineGenerator)
      .style("cursor", "pointer")
      .on("mouseenter", () => {
        hoveredSeries = key;
        updateLineEmphasis();
      })
      .on("mouseleave", () => {
        hoveredSeries = null;
        updateLineEmphasis();
      });

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    lineSelections.set(key, path);
  });

  // Tracking circles
  const dotGroup = chart.append("g").attr("class", "dots");
  incomeOrder.forEach(key => {
    const circle = dotGroup
      .append("circle")
      .attr("r", 6)
      .attr("fill", colorMap[key])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0);
    dotSelections.set(key, circle);
  });

  // Hover guideline
  const hoverLine = chart
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#111")
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5,5")
    .attr("opacity", 0);

  // Legend with toggle and hover highlight
  const legend = svg
    .append("g")
    .attr("transform", `translate(${margin.left + innerWidth + 24},${margin.top})`);

  const legendItems = legend
    .selectAll(".legend-item")
    .data(incomeOrder)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (_, i) => `translate(0, ${i * 26})`)
    .style("cursor", "pointer")
    .on("mouseenter", (_, key) => {
      hoveredSeries = key;
      updateLineEmphasis();
    })
    .on("mouseleave", () => {
      hoveredSeries = null;
      updateLineEmphasis();
    })
    .on("click", (_, key) => {
      const current = visibilityState.get(key);
      visibilityState.set(key, !current);
      dotSelections.get(key)?.attr("opacity", 0);
      hoverLine.attr("opacity", 0);
      tooltip.style("opacity", 0);
      updateLineEmphasis();
    });

  legendItems
    .append("rect")
    .attr("width", 16)
    .attr("height", 16)
    .attr("rx", 3)
    .attr("fill", d => colorMap[d])
    .attr("opacity", 1)
    .each(function (d) {
      legendSquares.set(d, d3.select(this));
    });

  legendItems
    .append("text")
    .attr("x", 22)
    .attr("y", 12)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .text(d => d);

  // Hover interactions
  const handleMouseLeave = () => {
    hoverLine.transition().duration(120).attr("opacity", 0);
    dotSelections.forEach(circle => circle.transition().duration(120).attr("opacity", 0));
    tooltip.transition().duration(120).style("opacity", 0);
  };

  const formatTooltip = (year, rows) => {
    const items = rows
      .map(
        r =>
          `<div style="margin-top:4px;"><span style="color:${r.color};font-weight:700;">●</span> ${r.label}: ${r.value.toFixed(
            2
          )}%</div>`
      )
      .join("");
    return `<div style="margin-bottom:6px;font-weight:700;">${year}</div>${items}`;
  };

  chart
    .on("mousemove", event => {
      const [mx] = d3.pointer(event, chart.node());
      if (mx < 0 || mx > innerWidth) {
        handleMouseLeave();
        return;
      }

      const hoveredYear = Math.round(x.invert(mx));
      if (hoveredYear < xDomain[0] || hoveredYear > xDomain[1]) {
        handleMouseLeave();
        return;
      }

      const lineX = x(hoveredYear);
      hoverLine
        .attr("x1", lineX)
        .attr("x2", lineX)
        .transition()
        .duration(100)
        .attr("opacity", 0.7);

      const rows = [];
      incomeOrder.forEach(key => {
        if (!visibilityState.get(key)) {
          dotSelections.get(key)?.transition().duration(100).attr("opacity", 0);
          return;
        }
        const val = valueLookup.get(key)?.get(hoveredYear);
        if (val === undefined) {
          dotSelections.get(key)?.transition().duration(100).attr("opacity", 0);
          return;
        }
        const targetOpacity =
          hoveredSeries && hoveredSeries !== key ? 0.25 : 1;
        dotSelections
          .get(key)
          ?.attr("cx", lineX)
          .attr("cy", y(val))
          .transition()
          .duration(120)
          .attr("opacity", targetOpacity);
        rows.push({ label: key, value: val, color: colorMap[key] });
      });

      if (!rows.length) {
        handleMouseLeave();
        return;
      }

      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(formatTooltip(hoveredYear, rows));
    })
    .on("mouseleave", () => handleMouseLeave());

  updateLineEmphasis();
};
