// NDVI Greening Trends — fully interactive showcase visualization
const svg = d3.select("#linechart");
const baselineSvg = d3.select("#baselineChart");
const mapSvg = d3.select("#mapChart");
const trendsContainer = d3.select("#view-trends");
const mapContainer = d3.select("#view-map");
const viewToggleTrends = d3.select("#btnTrends");
const viewToggleMap = d3.select("#btnMap");
const viewDescription = d3.select("#view-description");
const tooltip = d3.select("#tooltip");

const incomeOrder = ["High income", "Upper-middle income", "Lower-middle income"];
const colorMap = {
  "High income": "#007aff",
  "Upper-middle income": "#2dd1ac",
  "Lower-middle income": "#f9c00c"
};

let dataset = [];
let visibilityState = new Map(incomeOrder.map(key => [key, true]));
let worldGeoJSON = null;
let countryNDVI2024 = [];
let mapVisible = false;
let mapRendered = false;

// Load CSV data with strict parsing
d3.csv("ndvi_income_year.csv", d => ({
  year: +d.year,
  // TODO: add iso_code column to CSV for proper country mapping.
  iso_code: (d.iso_code || "").trim(),
  ndvi: +d.ndvi,
  ndvi_pct_change: +d.ndvi_pct_change,
  income_group: d.income_group
})).then(data => {
  dataset = data.filter(
    d =>
      Number.isFinite(d.year) &&
      Number.isFinite(d.ndvi) &&
      Number.isFinite(d.ndvi_pct_change) &&
      incomeOrder.includes(d.income_group)
  );
  countryNDVI2024 = dataset.filter(d => d.year === 2024);
  initTooltip();
  renderBaselineNDVI();
  render();
  // PLACE world.geojson HERE — use Natural Earth Admin 0 Countries
  d3.json("world.geojson")
    .then(geo => {
      worldGeoJSON = geo;
      mapRendered = false;
    })
    .catch(() => {});

  trendsContainer.style("display", "block");
  mapContainer.style("display", "none");
  viewDescription.text(
    "These lines show NDVI percent change by income group relative to the 2000–2005 baseline. Hover over any year to compare group trajectories and see where the greening gap expands."
  );

  const setView = view => {
    mapVisible = view === "map";
    viewToggleTrends.classed("active", !mapVisible);
    viewToggleMap.classed("active", mapVisible);
    trendsContainer.style("display", mapVisible ? "none" : "block");
    mapContainer.style("display", mapVisible ? "block" : "none");
    if (mapVisible && worldGeoJSON) {
      mapSvg.selectAll("*").remove();
      renderWorldMap(countryNDVI2024);
      mapRendered = true;
    } else {
      svg.selectAll("*").remove();
      render();
    }
    viewDescription.text(
      mapVisible
        ? "This choropleth highlights how absolute greenness or NDVI percent change varies across countries in 2024. Hover on countries to explore contrasts and check whether regional patterns reinforce the global greening inequality trend."
        : "These lines show NDVI percent change by income group relative to the 2000–2005 baseline. Hover over any year to compare group trajectories and see where the greening gap expands."
    );
  };

  viewToggleTrends.on("click", () => setView("trends"));
  viewToggleMap.on("click", () => setView("map"));
  setView("trends");

  window.addEventListener("resize", () => {
    if (mapVisible) {
      mapSvg.selectAll("*").remove();
      renderWorldMap(countryNDVI2024);
    } else {
      svg.selectAll("*").remove();
      render();
    }
    d3.select("#baselineChart").selectAll("*").remove();
    renderBaselineNDVI();
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

// Baseline NDVI bar chart
const renderBaselineNDVI = () => {
  if (!dataset.length || baselineSvg.empty() || !baselineSvg.node()) return;
  baselineSvg.selectAll("*").remove();

  const measured = baselineSvg.node().getBoundingClientRect();
  const width = measured.width || 960;
  const height = measured.height || 360;
  const margin = { top: 80, right: 40, bottom: 90, left: 80 };
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);

  baselineSvg
    .attr("width", width)
    .attr("height", height)
    .attr("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif")
    .attr("font-size", 12);

  const chart = baselineSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  baselineSvg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 32)
    .attr("fill", "#0f172a")
    .attr("font-size", 22)
    .attr("font-weight", 700)
    .text("Baseline NDVI Levels (2000–2005)");

  baselineSvg
    .append("text")
    .attr("x", margin.left)
    .attr("y", 54)
    .attr("fill", "#4b5563")
    .attr("font-size", 15)
    .text("Absolute greenness by world income group");

  const baselineMeans = new Map(
    d3.rollups(
      dataset.filter(d => d.year >= 2000 && d.year <= 2005),
      v => d3.mean(v, d => d.ndvi),
      d => d.income_group
    )
  );

  const barData = incomeOrder.map(key => ({
    income_group: key,
    mean: baselineMeans.get(key) ?? 0
  }));

  const x = d3.scaleBand().domain(incomeOrder).range([0, innerWidth]).padding(0.35);
  const yMax = d3.max(barData, d => d.mean) || 1;
  const y = d3
    .scaleLinear()
    .domain([0, yMax * 1.08])
    .nice()
    .range([innerHeight, 0]);

  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .call(g => g.selectAll(".domain").attr("stroke", "#111"))
    .call(g => g.selectAll("text").attr("fill", "#111").attr("font-size", 12));

  chart
    .append("g")
    .call(d3.axisLeft(y).ticks(6))
    .call(g => g.selectAll(".domain").attr("stroke", "#111"))
    .call(g => g.selectAll("text").attr("fill", "#111").attr("font-size", 12));

  chart
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 52)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("text-anchor", "middle")
    .text("Income Group");

  chart
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -56)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("text-anchor", "middle")
    .text("NDVI (absolute)");

  const bars = chart
    .selectAll(".bar")
    .data(barData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.income_group))
    .attr("y", d => y(d.mean))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.mean))
    .attr("fill", d => colorMap[d.income_group])
    .attr("opacity", 1)
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      d3.select(event.currentTarget).transition().duration(120).attr("opacity", 0.85);
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(
          `<div style="font-weight:700;margin-bottom:6px;">${d.income_group}</div><div>Baseline NDVI: ${d.mean.toFixed(
            2
          )}</div>`
        );
    })
    .on("mousemove", event => {
      tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 10}px`);
    })
    .on("mouseleave", event => {
      d3.select(event.currentTarget).transition().duration(120).attr("opacity", 1);
      tooltip.transition().duration(120).style("opacity", 0);
    });

  chart
    .selectAll(".bar-label")
    .data(barData)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.income_group) + x.bandwidth() / 2)
    .attr("y", d => Math.max(y(d.mean) - 6, 0))
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .attr("text-anchor", "middle")
    .text(d => d.mean.toFixed(2));
};

// World map choropleth for NDVI percent change in 2024
const renderWorldMap = countryData => {
  if (!worldGeoJSON || mapSvg.empty() || !mapSvg.node()) return;
  mapSvg.selectAll("*").remove();

  const measured = mapSvg.node().getBoundingClientRect();
  const width = measured.width || 960;
  const height = measured.height || 520;
  const margin = { top: 20, right: 20, bottom: 70, left: 20 };
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);

  mapSvg
    .attr("width", width)
    .attr("height", height)
    .attr("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif")
    .attr("font-size", 12);

  const map = mapSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const projection = d3
    .geoNaturalEarth1()
    .fitSize([innerWidth, innerHeight], worldGeoJSON);
  const path = d3.geoPath(projection);

  const lookup = new Map(
    countryData
      .filter(d => (d.iso_code || "").trim())
      .map(d => [(d.iso_code || "").trim().toUpperCase(), d.ndvi_pct_change])
  );

  const values = countryData.map(d => d.ndvi_pct_change).filter(Number.isFinite);
  const [minVal, maxVal] = [d3.min(values) ?? 0, d3.max(values) ?? 0];
  const midVal = (minVal + maxVal) / 2;

  const colorScale = d3.scaleSequential(d3.interpolateGreens).domain([minVal, maxVal]).clamp(true);

  const getISO = feature =>
    (feature.properties?.ISO_A3 ||
      feature.properties?.iso_a3 ||
      feature.properties?.ISO3 ||
      feature.properties?.ISO3_CODE ||
      feature.properties?.ADM0_A3 ||
      "").toString().toUpperCase();

  const countries = map
    .selectAll("path")
    .data(worldGeoJSON.features || [])
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", d => {
      const iso = getISO(d);
      const val = lookup.get(iso);
      return Number.isFinite(val) ? colorScale(val) : "#e5e7eb";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.6)
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      const iso = getISO(d);
      const val = lookup.get(iso);
      d3.select(event.currentTarget)
        .transition()
        .duration(120)
        .attr("stroke", "#111")
        .attr("stroke-width", 1.1)
        .attr("fill", Number.isFinite(val) ? d3.color(colorScale(val)).darker(0.4) : "#d1d5db");
      tooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 10}px`)
        .html(
          `<div style="font-weight:700;margin-bottom:6px;">${d.properties?.NAME || d.properties?.ADMIN || "Unknown"}</div><div>NDVI Change (2024): ${
            Number.isFinite(val) ? val.toFixed(2) : "N/A"
          }%</div>`
        );
    })
    .on("mousemove", event => {
      tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 10}px`);
    })
    .on("mouseleave", (event, d) => {
      const iso = getISO(d);
      const val = lookup.get(iso);
      d3.select(event.currentTarget)
        .transition()
        .duration(120)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.6)
        .attr("fill", Number.isFinite(val) ? colorScale(val) : "#e5e7eb");
      tooltip.transition().duration(120).style("opacity", 0);
    });

  const legendWidth = Math.min(220, innerWidth * 0.5);
  const legendHeight = 12;
  const legendX = margin.left + 12;
  const legendY = height - margin.bottom + 24;

  const defs = mapSvg.append("defs");
  const gradient = defs.append("linearGradient").attr("id", "mapLegendGradient");
  gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(minVal));
  gradient.append("stop").attr("offset", "50%").attr("stop-color", colorScale(midVal));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(maxVal));

  const legend = mapSvg.append("g").attr("transform", `translate(${legendX},${legendY})`);

  legend
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#mapLegendGradient)")
    .attr("stroke", "#e5e7eb")
    .attr("rx", 4);

  const legendScale = d3.scaleLinear().domain([minVal, maxVal]).range([0, legendWidth]);
  const legendAxis = d3.axisBottom(legendScale).ticks(3).tickFormat(d => `${d.toFixed(1)}%`);

  legend
    .append("g")
    .attr("transform", `translate(0,${legendHeight + 6})`)
    .call(legendAxis)
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("text").attr("fill", "#111").attr("font-size", 11));

  legend
    .append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -6)
    .attr("fill", "#111")
    .attr("font-size", 12)
    .attr("text-anchor", "middle")
    .text("NDVI Percent Change (2024)");
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
