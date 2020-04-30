var diameter = 900,
    radius = diameter / 2,
    innerRadius = radius - 250;

var cluster = d3.cluster()
    .size([360, innerRadius]);

var line = d3.lineRadial()
    .curve(d3.curveBundle.beta(0.85))
    .radius(function(d) { return d.y; })
    .angle(function(d) { return d.x / 180 * Math.PI; });


var svg = d3.select("body").append("svg")
    .attr("width", diameter)
    .attr("height", diameter)
  .append("g")
    .attr("transform", "translate(" + radius + "," + radius + ")");

// these variables will be used for the nodes and links in the graph in renderChart()
var link, node;

// popup table of sources / targets in meso view
var popup = d3.select("body").append("div")
  .classed("popup", true);

var closePopup = popup.append("text")
  .attr("class", "closePopup")
  .text('\uf00d')
  .on("click", function () {
    popup.attr("style", "display:none");
  })
  .on("mouseover", function(d) {
    d3.select(this).style("cursor", "pointer"); 
  });

var popupTitle = popup.append("text")
  .attr("text-anchor", "middle")
  .attr("class", "tableTitle");


var sourceTable, targetTable;

// parse the json files produced with python scripts


var zoomedIn;
var treeDepth;

var linkedNodes;
var visibleLeaves;
var mesoLinks;


function renderChart() {
  function nodeText(thisNode) {
    // add this to zoomed in view if more info about nodes is needed thisNode.data.children[0].name + " " + 
    text = zoomedIn? 
      thisNode.data.name + " " + thisNode.data.children[0].meso :
      thisNode.data.children[0].name.substr(0,2)+" "+thisNode.data.name;
    return text;
  }
  
  svg.selectAll(".node").remove();
  node = svg.append("g").selectAll(".node");
  node = node
    .data(visibleLeaves)
    .enter().append("text")
      .attr("class", "node")
      .attr("fill", d => d.color)
      .attr("dy", "0.31em")
      .text(d => nodeText(d))
      //.text(d => d.x)
      .attr("transform", function(d) { return "rotate(" + (d.previousX - 90) + ")translate(" + (d.previousY + 8) + ",0)" + 
      	(d.previousX < 180 ? "" : "rotate(180)"); })
      .attr("text-anchor", function(d) { return d.previousX < 180 ? "start" : "end"; })
      .on("mouseover", mouseovered)
      .on("mouseout", mouseouted)
      .on("click", zoomedIn? microView : mesoView);
  node
    .transition()
      .duration(750)
      .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 8) + ",0)" + (d.x < 180 ? "" : "rotate(180)"); })
      .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })


  svg.selectAll(".link").remove();
  
  link = svg.append("g").selectAll(".link");
  link = link
    .data(linkedNodes)
    .enter().append("path")
      .each(function(nodeBundle) { 
        nodeBundle.source = nodeBundle[0], 
        nodeBundle.target = nodeBundle[nodeBundle.length - 1];
      })
      .attr("class", "link")
      .attr("d", line);

}

function showNodeConnections(filteredLinks, id, title) {
  /**
  * Turn data from links into table of source / target domains
  * Code based on http://bl.ocks.org/d3noob/473f0cf66196a008cf99
  * id specifies the node for which the micro view is generated
  */
  var tableData;
  var tableHeader;
  var isNodeSource = true;

  // clear all previous table data
  popup.selectAll("table").remove();
  // set main title of tables
  popupTitle
  	.text(title);

  function reformatLinkList(linkList) {
  return linkList.map(d => {
      let thisRow = []
      let obj = {}
      obj.value = d.source.id+": "+d.source.translation+" ("+d.source.greek + ")";
      obj.style = isNodeSource? "black" : "red";
      thisRow.push(obj);
      obj = {}
      obj.value = d.target.id+": "+d.target.translation;
      obj.style = isNodeSource? "blue" : "black";
      thisRow.push(obj);
      return thisRow;
    });
  }
  
  function makeTable() {
    var table = popup.append("table");
    
    var thead = table.append("thead");
    var tbody = table.append("tbody");

    thead.append("tr")
        .selectAll("th")
        .data(tableHeader)
        .enter()
        .append("th")
            .text(function(column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll("tr")
        .data(tableData)
        .enter()
        .append("tr");


    // create a cell in each row for each column
    var cells = rows.selectAll("td")
        .data(function (row) {
          return [row[0], row[1]];
          })
        .enter()
        .append("td")
          .text(d => d.value)
          .style('color', d => d.style);

    return table;
  }
  
  ////// table of all items for which clicked node is source domain /////
  let relevantLinks = filteredLinks.filter(l => l.source.id===id);
  if (relevantLinks.length>0) {
    let sourceDomain = id + " as source domain";
    
    isNodeSource = true;
    tableData = reformatLinkList(relevantLinks);
    tableData.sort( (row1, row2) => row1[1].value.localeCompare(row2[1].value) );

    tableHeader = [sourceDomain, 'Targets'];
  
    sourceTable = makeTable();
  }

  ///// table of all items for which clicked node is target domain ////
  relevantLinks = filteredLinks.filter(l => l.target.id===id);
  if (relevantLinks.length>0) {
    let targetDomain = id + " as target domain";

    isNodeSource = false;
    tableData = reformatLinkList(relevantLinks);
    tableData.sort( (row1, row2) => row1[0].value.localeCompare(row2[0].value) );
    tableHeader = ['Sources', targetDomain];

    targetTable = makeTable();
  }
  
}


function mouseovered(d) {
  node
      .each(function(n) { n.target = n.source = false; });

  link
      .classed("link--target", function(l) { if (l.target === d) return l.source.source = true; })
      .classed("link--source", function(l) { if (l.source === d) return l.target.target = true; })
    .filter(function(l) { return l.target === d || l.source === d; })
      .raise();

  node
      .classed("node--target", function(n) { return n.target; })
      .classed("node--source", function(n) { return n.source; });
}

function mouseouted(d) {
  link
      .classed("link--target", false)
      .classed("link--source", false);

  node
      .classed("node--target", false)
      .classed("node--source", false)
      .classed("node--clickedDomain", n => n.clickedDomain);
}