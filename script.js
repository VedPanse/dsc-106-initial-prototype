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

// Income groups and colors
const incomeOrder = ["High income", "Upper-middle income", "Lower-middle income"];
const colorMap = {
  "High income": "#1d4ed8",   // deep blue
  "Upper-middle income": "#16a34a", // vivid green
  "Lower-middle income": "#f97316"  // bright orange
};

// Ocean color (shared for background + water polygons)
const OCEAN_COLOR = "#e0f2fe";  // lighter, softer blue
const MAP_BG_COLOR = "#e5e7eb";  // outside the globe

// Country → income data sourced from CSV
const countryIncomeMap = new Map();
const skipCountries = new Set();
const DEFAULT_INCOME_GROUP = "Lower-middle income";

// Map country name → income group. Unknowns / water → null (no data).
const getIncomeGroupForCountry = name => {
  if (!name) return null;

  if (
    skipCountries.has(name) ||
    /Ocean|Sea|Bay|Gulf|Lake|World/i.test(name)
  ) {
    return null;
  }

  const mapped = countryIncomeMap.get(name);
  if (mapped) return mapped;

  // Everything else treated as lower-middle in this prototype
  return DEFAULT_INCOME_GROUP;
};

let dataset = [];
let visibilityState = new Map(incomeOrder.map(key => [key, true]));
let worldGeoJSON = null;
let mapVisible = false;

// ---------- Data loading ----------
const loadCountryIncome = () =>
  d3.csv("country_income_groups.csv", d => ({
    name: (d.name || "").trim(),
    income_group: (d.income_group || "").trim() || null,
    skip: String(d.skip || "").toLowerCase() === "true"
  }));

Promise.all([
  d3.csv("ndvi_income_year.csv", d => ({
    year: +d.year,
    income_group: d.income_group,
    ndvi: +d.ndvi,
    ndvi_pct_change: +d.ndvi_pct_change
  })),
  loadCountryIncome(),
  d3.json("world.geojson").catch(() => null)
]).then(([data, countryRows, geo]) => {
  dataset = data.filter(
    d =>
      Number.isFinite(d.year) &&
      Number.isFinite(d.ndvi) &&
      Number.isFinite(d.ndvi_pct_change) &&
      incomeOrder.includes(d.income_group)
  );

  countryRows.forEach(row => {
    if (!row.name) return;
    if (row.skip) {
      skipCountries.add(row.name);
      return;
    }
    if (row.income_group) {
      countryIncomeMap.set(row.name, row.income_group);
    }
  });

  worldGeoJSON = geo;

  initTooltip();
  renderBaselineNDVI();
  renderLines();

  trendsContainer.style("display", "block");
  mapContainer.style("display", "none");
  viewDescription.text(
    "These lines show NDVI percent change by income group relative to a 2000–2005 baseline. Hover to compare group trajectories and see where the greening gap expands."
  );

  const setView = view => {
    mapVisible = view === "map";
    viewToggleTrends.classed("active", !mapVisible);
    viewToggleMap.classed("active", mapVisible);
    trendsContainer.style("display", mapVisible ? "none" : "block");
    mapContainer.style("display", mapVisible ? "block" : "none");

    if (mapVisible) {
      renderWorldMap();
    } else {
      renderLines();
    }

    viewDescription.text(
      mapVisible
        ? "This choropleth highlights how NDVI percent change in 2024 varies across countries, grouped by income level. Hover to explore contrasts and check whether regional patterns reinforce the global greening inequality trend."
        : "These lines show NDVI percent change by income group relative to a 2000–2005 baseline. Hover to compare group trajectories and see where the greening gap expands."
    );
  };

  viewToggleTrends.on("click", () => setView("trends"));
  viewToggleMap.on("click", () => setView("map"));
  setView("trends");

  window.addEventListener("resize", () => {
    renderBaselineNDVI();
    if (mapVisible) {
      renderWorldMap();
    } else {
      renderLines();
    }
  });
});

// ---------- Tooltip ----------
const initTooltip = () => {
  tooltip
    .style("position", "absolute")
    .style("background", "#111")
    .style("color", "#fff")
    .style("padding", "12px 14px")
    .style("border-radius", "10px")
    .style("box-shadow", "0 12px 30px rgba(0,0,0,0.28)")
    .style(
      "font-family",
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    )
    .style("font-size", "14px")
    .style("pointer-events", "none")
    .style("opacity", 0);
};

// ---------- Baseline NDVI bar chart ----------
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
    .attr(
      "font-family",
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    )
    .attr("font-size", 12);

  const chart = baselineSvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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

  const x = d3.scaleBand()
    .domain(barData.map(d => d.income_group))
    .range([0, innerWidth])
    .padding(0.3);

  const yMax = d3.max(barData, d => d.mean) ?? 1;
  const y = d3.scaleLinear()
    .domain([0, yMax * 1.1])
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
          `<div style="font-weight:700;margin-bottom:4px;">${d.income_group}</div>
           <div>Baseline NDVI (2000–2005): ${d.mean.toFixed(3)}</div>`
        );
    })
    .on("mousemove", event => {
      tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 10}px`);
    })
    .on("mouseleave", () => {
      tooltip.transition().duration(120).style("opacity", 0);
      bars.transition().duration(120).attr("opacity", 1);
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

// ---------- World map choropleth: NDVI % change in 2024 ----------
const renderWorldMap = () => {
  if (!worldGeoJSON || mapSvg.empty() || !mapSvg.node() || !dataset.length) return;
  mapSvg.selectAll("*").remove();

  const measured = mapSvg.node().getBoundingClientRect();
  const width = measured.width || 960;
  const height = measured.height || 520;
  const margin = { top: 20, right: 20, bottom: 80, left: 20 };
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);

  mapSvg
    .attr("width", width)
    .attr("height", height)
    .style("background", MAP_BG_COLOR) // outside the globe
    .attr(
      "font-family",
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    )
    .attr("font-size", 12);

  const mapG = mapSvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const projection = d3.geoNaturalEarth1().fitSize([innerWidth, innerHeight], worldGeoJSON);
  const path = d3.geoPath(projection);

  // Ocean *inside* the globe
  mapG.append("path")
    .datum({ type: "Sphere" })
    .attr("d", path)
    .attr("fill", OCEAN_COLOR)
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .style("pointer-events", "none");

  // Average NDVI % change in 2024 for each income group
  const ndviByIncome2024 = new Map(
    d3.rollups(
      dataset.filter(d => d.year === 2024 && incomeOrder.includes(d.income_group)),
      v => d3.mean(v, d => d.ndvi_pct_change),
      d => d.income_group
    )
  );

  const handleHover = (event, feature) => {
    const rawName = feature.properties && feature.properties.name;
    const name = rawName || "Unknown";
    const group = getIncomeGroupForCountry(rawName);
    const val = group ? ndviByIncome2024.get(group) : undefined;

    if (!group) {
      tooltip.interrupt();
      tooltip.transition().duration(120).style("opacity", 0);
      return;
    }

    d3.select(event.currentTarget)
      .transition().duration(120)
      .attr("stroke", "#111")
      .attr("stroke-width", 1.1);

    tooltip.interrupt(); // cancel any pending fade-out from a previous country
    tooltip
      .style("opacity", 1)
      .style("left", `${event.pageX + 15}px`)
      .style("top", `${event.pageY - 10}px`)
      .html(
        `<div style="font-weight:700;margin-bottom:6px;">${name}</div>
         <div>Income group: ${group}</div>
         <div>NDVI percent change (2024): ${
           Number.isFinite(val) ? val.toFixed(2) + "%" : "N/A"
         }</div>`
      );
  };

  // ---- COUNTRIES (income colors) ----
  mapG.selectAll("path")
    .data(worldGeoJSON.features || [])
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", feature => {
      const rawName = feature.properties && feature.properties.name;
      const group = getIncomeGroupForCountry(rawName);

      // Anything skipped or water-like should blend into the ocean
      const isWater =
        !rawName ||
        skipCountries.has(rawName) ||
        /Ocean|Sea|Bay|Gulf|Lake|World/i.test(rawName);

      if (isWater) return OCEAN_COLOR;
      return group ? colorMap[group] : "#d1d5db"; // grey for true "no data / not classified" land
    })
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.6)
    .style("cursor", "pointer")
    .on("mouseenter", handleHover)
    .on("click", handleHover)
    .on("mousemove", event => {
      tooltip
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 10}px`);
    })
    .on("mouseleave", event => {
      d3.select(event.currentTarget)
        .transition().duration(120)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.6);
      tooltip.transition().duration(120).style("opacity", 0);
    });

  // ---- Legend ----
  const legend = mapSvg.append("g")
    .attr("transform", `translate(${margin.left + 10},${height - margin.bottom + 30})`);

  const legendItems = [
    { label: "High income", key: "High income" },
    { label: "Upper-middle income", key: "Upper-middle income" },
    { label: "Lower-middle income", key: "Lower-middle income" },
    { label: "No data / not classified", key: null }
  ];

  const entry = legend.selectAll(".legend-entry")
    .data(legendItems)
    .enter()
    .append("g")
    .attr("class", "legend-entry")
    .attr("transform", (_, i) => `translate(${i * 190},0)`);

  entry.append("rect")
    .attr("x", 0)
    .attr("y", -10)
    .attr("width", 18)
    .attr("height", 12)
    .attr("rx", 3)
    .attr("fill", d => d.key ? colorMap[d.key] : "#d1d5db")
    .attr("stroke", "#111")
    .attr("stroke-width", 0.8);

  entry.append("text")
    .attr("x", 26)
    .attr("y", 0)
    .attr("fill", "#111")
    .attr("font-size", 12)
    .attr("dominant-baseline", "central")
    .text(d => d.label);

  legend.append("text")
    .attr("x", 0)
    .attr("y", -26)
    .attr("fill", "#111")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("NDVI change in 2024, by income group");
};



// ---------- Main NDVI trend lines ----------
const renderLines = () => {
  if (!dataset.length || svg.empty() || !svg.node()) return;
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
    .attr(
      "font-family",
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    )
    .attr("font-size", 12);

  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

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

  const xDomain = [2000, 2024];
  const x = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);

  const yExtent = d3.extent(dataset, d => d.ndvi_pct_change);
  const yPad = (yExtent[1] - yExtent[0]) * 0.08 || 2;
  const y = d3.scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .nice()
    .range([innerHeight, 0]);

  chart
    .append("g")
    .attr("class", "gridlines")
    .call(
      d3.axisLeft(y)
        .ticks(8)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .call(g => g.selectAll("line").attr("stroke", "#0f172a").attr("stroke-opacity", 0.08))
    .call(g => g.select(".domain").remove());

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

  const area = d3.area()
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

  const parisX = x(2015);
  chart
    .append("line")
    .attr("x1", parisX)
    .attr("x2", parisX)
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#111")
    .attr("stroke-dasharray", "4,4")
    .attr("stroke-width", 1.2)
    .attr("opacity", 0.9);

  chart
    .append("text")
    .attr("x", parisX + 6)
    .attr("y", 14)
    .attr("fill", "#111")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("Paris Agreement (2015)");

  const valueLookup = new Map(incomeOrder.map(key => [key, new Map()]));
  dataset.forEach(d => {
    valueLookup.get(d.income_group)?.set(d.year, d.ndvi_pct_change);
  });

  const lineGenerator = d3.line()
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
      legendRect?.attr(
        "fill",
        visible ? colorMap[key] : d3.color(colorMap[key]).copy({ opacity: 0.3 })
      );
      legendRect?.attr("stroke-opacity", hoveredSeries === key ? 1 : 0.7);
    });
  };

  incomeOrder.forEach(key => {
    const series = dataset
      .filter(d => d.income_group === key)
      .sort((a, b) => d3.ascending(a.year, b.year));

    const path = chart
      .append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", colorMap[key])
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("opacity", 1)
      .attr("d", lineGenerator);

    lineSelections.set(key, path);

    const circle = chart
      .append("circle")
      .attr("r", 6)
      .attr("fill", colorMap[key])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0);

    dotSelections.set(key, circle);
  });

  const hoverLine = chart
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#111")
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5,5")
    .attr("opacity", 0);

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
    .on("click", (_, key) => {
      const current = visibilityState.get(key);
      visibilityState.set(key, !current);
      updateLineEmphasis();
    })
    .on("mouseenter", (_, key) => {
      hoveredSeries = key;
      updateLineEmphasis();
    })
    .on("mouseleave", () => {
      hoveredSeries = null;
      updateLineEmphasis();
    });

  legendItems
    .append("rect")
    .attr("x", 0)
    .attr("y", -10)
    .attr("width", 22)
    .attr("height", 14)
    .attr("rx", 4)
    .attr("stroke", "#111")
    .attr("stroke-width", 1)
    .attr("fill", key => colorMap[key])
    .each(function (key) {
      legendSquares.set(key, d3.select(this));
    });

  legendItems
    .append("text")
    .attr("x", 30)
    .attr("y", 0)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("dominant-baseline", "middle")
    .text(d => d);

  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -20)
    .attr("fill", "#111")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Toggle & highlight series");

  updateLineEmphasis();

  const handleMouseLeave = () => {
    hoverLine.transition().duration(100).attr("opacity", 0);
    tooltip.transition().duration(100).style("opacity", 0);
    incomeOrder.forEach(key => {
      dotSelections.get(key)?.transition().duration(100).attr("opacity", 0);
    });
  };

  const formatTooltip = (year, rows) => {
    const body = rows
      .map(
        d =>
          `<div style="display:flex;align-items:center;margin-bottom:2px;">
             <span style="display:inline-block;width:10px;height:10px;border-radius:999px;margin-right:6px;background:${colorMap[d.income_group]};"></span>
             <span style="flex:1;">${d.income_group}</span>
             <span style="margin-left:8px;font-weight:600;">${d.ndvi_pct_change.toFixed(2)}%</span>
           </div>`
      )
      .join("");
    return `<div style="margin-bottom:6px;font-weight:700;">${year}</div>${body}`;
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
        .duration(80)
        .attr("opacity", 0.7);

      const rows = [];
      incomeOrder.forEach(key => {
        if (!visibilityState.get(key)) return;
        const v = valueLookup.get(key)?.get(hoveredYear);
        if (!Number.isFinite(v)) return;
        rows.push({
          income_group: key,
          year: hoveredYear,
          ndvi_pct_change: v
        });
        const circle = dotSelections.get(key);
        circle
          ?.attr("cx", lineX)
          .attr("cy", y(v))
          .transition()
          .duration(80)
          .attr("opacity", 1);
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
};
