const { docker, listAllContainers, inspectContainer } = require("./docker");

async function buildTopology() {
  const containers = await listAllContainers(true);
  const networks = await docker.listNetworks();

  const networkMap = {};
  for (const net of networks) {
    const netInfo = await docker.getNetwork(net.Id).inspect();
    networkMap[net.Id] = {
      id: net.Id,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      containers: [],
    };
    if (netInfo.Containers) {
      for (const [cid, cdata] of Object.entries(netInfo.Containers)) {
        networkMap[net.Id].containers.push({
          id: cid,
          name: cdata.Name,
          ipv4: cdata.IPv4Address,
        });
      }
    }
  }

  const nodes = containers.map((c) => {
    const composeService = c.labels["com.docker.compose.service"] || c.name;
    const composeProject = c.labels["com.docker.compose.project"] || "standalone";
    return {
      id: c.id,
      name: c.name,
      image: c.image,
      state: c.state,
      status: c.status,
      health: c.health,
      ports: c.ports,
      composeService,
      composeProject,
      networks: [],
      labels: c.labels,
    };
  });

  const nodeMap = {};
  nodes.forEach((n) => { nodeMap[n.id] = n; });

  for (const net of Object.values(networkMap)) {
    for (const nc of net.containers) {
      if (nodeMap[nc.id]) {
        nodeMap[nc.id].networks.push({
          name: net.name,
          ipv4: nc.ipv4,
          driver: net.driver,
        });
      }
    }
  }

  const edges = [];
  const seenEdges = new Set();

  for (const net of Object.values(networkMap)) {
    if (net.containers.length < 2) continue;
    if (net.name === "bridge" || net.name === "host" || net.name === "none") continue;

    for (let i = 0; i < net.containers.length; i++) {
      for (let j = i + 1; j < net.containers.length; j++) {
        const a = net.containers[i];
        const b = net.containers[j];
        const edgeKey = [a.id, b.id].sort().join("-");
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);

        let edgeType = "network";
        let direction = null;

        const aNode = nodeMap[a.id];
        const bNode = nodeMap[b.id];

        if (aNode && bNode) {
          if (aNode.composeProject === bNode.composeProject) {
            const aSvc = aNode.composeService;
            const bSvc = bNode.composeService;

            if (aSvc === "backend" && bSvc === "postgres") {
              direction = "backend->postgres";
              edgeType = "depends_on";
            } else if (aSvc === "backend" && bSvc === "redis") {
              direction = "backend->redis";
              edgeType = "depends_on";
            } else if (aSvc === "frontend" && bSvc === "backend") {
              direction = "frontend->backend";
              edgeType = "depends_on";
            } else if (aSvc === "postgres" && bSvc === "backend") {
              direction = "backend->postgres";
              edgeType = "depends_on";
            } else if (aSvc === "redis" && bSvc === "backend") {
              direction = "backend->redis";
              edgeType = "depends_on";
            } else if (aSvc === "backend" && bSvc === "frontend") {
              direction = "frontend->backend";
              edgeType = "depends_on";
            }
          }
        }

        edges.push({
          source: a.id,
          sourceName: a.name,
          target: b.id,
          targetName: b.name,
          type: edgeType,
          direction,
          network: net.name,
        });
      }
    }
  }

  const services = groupByService(nodes);

  return {
    nodes,
    edges,
    networks: Object.values(networkMap),
    services,
    summary: {
      totalContainers: nodes.length,
      runningContainers: nodes.filter((n) => n.state === "running").length,
      stoppedContainers: nodes.filter((n) => n.state !== "running").length,
      totalNetworks: Object.keys(networkMap).length,
      totalEdges: edges.length,
      totalServices: Object.keys(services).length,
    },
  };
}

function groupByService(nodes) {
  const services = {};
  for (const node of nodes) {
    const svc = node.composeService || node.name;
    if (!services[svc]) {
      services[svc] = {
        name: svc,
        containers: [],
        state: "running",
        image: node.image,
      };
    }
    services[svc].containers.push({
      id: node.id,
      name: node.name,
      state: node.state,
      health: node.health,
      ports: node.ports,
    });
    if (node.state !== "running") {
      services[svc].state = "degraded";
    }
  }
  return services;
}

async function getImpactAnalysis(containerId) {
  const topology = await buildTopology();
  const impacted = new Set();
  const queue = [containerId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (impacted.has(currentId)) continue;
    impacted.add(currentId);

    for (const edge of topology.edges) {
      if (edge.direction && edge.direction.includes("->")) {
        const [src, tgt] = edge.direction.split("->");
        const srcNode = topology.nodes.find((n) => n.composeService === src);
        const tgtNode = topology.nodes.find((n) => n.composeService === tgt);
        if (tgtNode && tgtNode.id === currentId && srcNode && !impacted.has(srcNode.id)) {
          queue.push(srcNode.id);
        }
      }
    }
  }

  const impactedNodes = topology.nodes.filter((n) => impacted.has(n.id) && n.id !== containerId);
  return {
    source: containerId,
    sourceName: topology.nodes.find((n) => n.id === containerId)?.name || containerId,
    impacted: impactedNodes.map((n) => ({
      id: n.id,
      name: n.name,
      service: n.composeService,
      state: n.state,
    })),
    impactedCount: impactedNodes.length,
  };
}

module.exports = { buildTopology, getImpactAnalysis };
