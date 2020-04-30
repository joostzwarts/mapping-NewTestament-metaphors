var nodeList = JSON.parse(nodes);
var linkList = JSON.parse(links);
// turns the data into a hierarchy of nodes with parent and children pointers
var tree = d3.hierarchy(nodeList);

function pruneTree(fullTree, depth) {
  /**
  * restore children
  * temporarily remove nodes below the level indicated by depth
  */
  // visit parents first
  fullTree.eachBefore(function(d) {

    // figure out if children were removed through filtering
    if (d.removedchildren) {
        // there was filtering on this node before
        d._children = d.removedchildren;
        d.removedchildren = null;
        // if not all nodes were filtered out, some are still in children array
        if (d.children) {
          d._children = d._children.concat(d.children);
        }
    }

    // restore children which were pruned / filtered previously
    if (d._children) {
      d.children = d._children;
      d._children = null;
    }

    if (d.depth===depth) {
      // remove children for specified depth
      d._children = d.children;
      d.children = null;
    }
    
  })
}

function constructLinks(leaves, linkData, filterAspect) {
  /**
  * based on information from list of links, construct maps between nodes
  * filterAspect indicates whether to use the id (mesoView) or the name (macroView) from the list of links
  */
  var linkNodeMap = [];
  linkData.forEach(function (d) {
    sources = leaves.filter(n =>
      n.data.name===d.source[filterAspect]);
    targets = leaves.filter(n => 
      n.data.name===d.target[filterAspect]);
    // in a d3 tree layout, each node has a path function, which returns the shortest path through the hierarchy
    linkNodeMap.push(sources[0].path(targets[0]));
  });
  return linkNodeMap;
}

function filterData(clickedNode, prunedTree, linkData, depth) {
  /** 
  * go through links and retain only those which are connected to the clicked node
  * go through tree and retain only the nodes connected to clicked node
  */
  
  var filteredLinks = linkData.filter(
    l => l.source.name===clickedNode.data.name || l.target.name==clickedNode.data.name
  );
  var nodesToRetain = []
  // make a list of all the nodes that are connected to the node the user clicked on
  filteredLinks.forEach(l => {
    nodesToRetain.push(l.source.id); 
    nodesToRetain.push(l.target.id);
  })
  nodesToRetain = _.uniq(nodesToRetain);
  // eachAfter visits leaves first
  prunedTree.eachAfter(function (thisNode) {
    if (thisNode.depth===depth) {
      if (thisNode.parent.data.name==clickedNode.data.name) {
        thisNode.clickedDomain = true;
      }
      else {
        thisNode.clickedDomain = false;
      }
      if (!_.includes(nodesToRetain, thisNode.data.name)) {
      // store the children first, then remove them
        thisNode.parent.removedchildren = thisNode.parent.removedchildren? thisNode.parent.removedchildren : [];
        thisNode.parent.removedchildren.push(thisNode);
        _.pull(thisNode.parent.children, thisNode);
      }
    }
  });
  return filteredLinks;
}

function filterLeaves(leaves, depth) {
  // necessary as some higher level nodes may also be childless after filtering out unconnected nodes
  return leaves.filter(d => d.depth===depth)
}

function previousPositions(currentLeaves) {
  /**
  * Run this before clustering to save the positions of the parent / children nodes
  * This enables transitions between macro/micro-view positions of domains
  */
  currentLeaves.forEach(function (d) {
    d.previousX = zoomedIn? d.parent.x : d._children[0].x;
    d.previousY = zoomedIn? d.parent.y : d._children[0].y;
    // avoid error for initial view (no previous call to cluster)
    if (d.previousX===undefined) {
      d.previousX=50;
      d.previousY=50;
    }
  })
}

function recalculatePositions(currentLeaves, clickedNode, anchorPoint) {
  let sortedLeaves = _.sortBy(currentLeaves, 'data.name');
  let domainGroups = _.sortedUniqBy(currentLeaves, 'parent.data.name');
  let spaceAvailable = 360 / (currentLeaves.length + 2 * (domainGroups.length));
  let anchorLeaves = sortedLeaves.filter( leaf => leaf.parent.data.name==clickedNode.data.name );
  let anchorNode = anchorLeaves[Math.floor(anchorLeaves.length/2)];
  let anchorNodeIndex = _.indexOf(sortedLeaves, anchorNode);
  let newAnchor = 0;
  let extraSpace = 0;
  sortedLeaves.forEach( function(leaf, index) {
    if (index>0) {
      // if the current leaf has a different parent than previous leaf, add extra space
      if (leaf.parent.data.name!=sortedLeaves[index-1].parent.data.name) {
        extraSpace = extraSpace + 2 * spaceAvailable;
      }
    }
    leaf.x = extraSpace + index * spaceAvailable;
    //console.log(leaf.x);
    if (index==anchorNodeIndex) {
      newAnchor = leaf.x;
    }
  })
  // adjust so that the nodes corresponding to the clicked nodes are in the same position
  sortedLeaves.forEach( leaf => leaf.x = (360 + leaf.x + (anchorPoint - newAnchor)) % 360);
  return sortedLeaves;
}