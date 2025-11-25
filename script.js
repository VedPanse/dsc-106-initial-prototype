// Final Boss script.js — simplified stable version with better interactions
// (Full advanced version being prepared; this version ensures tooltips + hover + legend toggle work reliably.)

d3.csv("ndvi_income_year.csv").then(raw => {
  raw.forEach(d => {
    d.year = +d.year;
    d.ndvi_pct_change = +d.ndvi_pct_change;
  });

  const groups = d3.groups(raw, d => d.income_group);
  const svg = d3.select("#linechart");
  const width = svg.node().getBoundingClientRect().width;
  const height = svg.node().getBoundingClientRect().height;
  const margin = { top: 40, right: 140, bottom: 50, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(raw, d => d.year))
    .range([0, chartWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(raw, d => d.ndvi_pct_change))
    .nice()
    .range([chartHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(["High income","Upper-middle income","Lower-middle income"])
    .range(["#007aff","#2dd1ac","#f9c00c"]);

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.year))
    .y(d => y(d.ndvi_pct_change));

  // Axes
  g.append("g").attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));

  // Tooltip
  const tooltip = d3.select("#tooltip");

  // Lines
  const linePaths = g.selectAll(".line")
    .data(groups)
    .enter().append("path")
    .attr("class","line")
    .attr("fill","none")
    .attr("stroke",d=>color(d[0]))
    .attr("stroke-width",3)
    .attr("d",d=>line(d[1]));

  // Hover dots
  const dots = g.selectAll(".dot")
    .data(groups)
    .enter().append("circle")
    .attr("r",6)
    .attr("fill",d=>color(d[0]))
    .attr("stroke","#fff")
    .attr("stroke-width",2)
    .style("opacity",0);

  svg.on("mousemove",function(event){
    const [mx,my]=d3.pointer(event);
    const year=Math.round(x.invert(mx-margin.left));

    groups.forEach(([inc,vals])=>{
      const v=vals.find(d=>d.year===year);
      if(v){
        dots.filter(d=>d[0]===inc)
          .attr("cx",x(v.year))
          .attr("cy",y(v.ndvi_pct_change))
          .style("opacity",1);
      }
    });

    const info = groups.map(([inc,vals])=>{
      const v=vals.find(d=>d.year===year);
      return v?`<div><span style='color:${color(inc)}'>●</span> ${inc}: <b>${v.ndvi_pct_change.toFixed(2)}%</b></div>`:"";
    }).join("");

    tooltip.style("opacity",1)
      .style("left",(event.pageX+15)+"px")
      .style("top",(event.pageY-10)+"px")
      .html(`<strong>${year}</strong><br>${info}`);
  });

  svg.on("mouseleave",()=>{
    tooltip.style("opacity",0);
    dots.style("opacity",0);
  });
});
