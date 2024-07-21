"use strict";

const EventEmitter = require ('node:events');
const fs = require ('node:fs');
const Docker = require ('dockerode');

const docker = new Docker ();

const headers = {
    "Content-Type": "application/json"
};
if (process.env.GORDON_ADMIN_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GORDON_ADMIN_TOKEN}`
}
if (process.env.GORDON_ADMIN_TOKEN_FILE) {
    headers.Authorization = `Bearer ${fs.readFileSync (process.env.GORDON_ADMIN_TOKEN_FILE).toString ()}`
}

const garageEvents = new EventEmitter ()
.once ('allNodes', async (garageNodes) => {
    for (let node of garageNodes) {
        let swarmNode = await docker.getNode (node.hostname);
        swarmNode = await swarmNode.inspect ();
        let garageID = node.id;
        let capacity = Number.parseInt (swarmNode.Spec.Labels[process.env.GORDON_CAPACITY_LABEL]);
        let zone = swarmNode.Spec.Labels[process.env.GORDON_ZONE_LABEL];
        let tags = swarmNode.Spec.Labels[process.env.GORDON_TAGS_LABEL].split (',');

        fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify (
                [{
                    id: garageID,
                    zone: zone,
                    capacity: capacity,
                    tags: tags
                }])
        });
    }

    clearInterval (knownNodesWatch);
})
.once ('allChanges', async () => {
    let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
        headers: headers
    });
    response = await response.json ();
    let version = response.version + 1;

    fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify (
            {
                version: version
            })
    });

    clearInterval (changesWatch);
});

let knownNodesWatch = setInterval (async () => {
    let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/status`, {
        headers: headers
    });
    response = await response.json ();
    let upNodes = 0;
    for (let node of response.nodes) {
        if (node.isUp) {
            upNodes++;
        }
    }
    if (upNodes == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
        garageEvents.emit ('allNodes', response.nodes);
    }
}, 1000);

let changesWatch = setInterval (async () => {
    let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
        headers: headers
    });
    response = await response.json ();
    let numChanges = response.stagedRoleChanges.length;
    if (numChanges == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
        garageEvents.emit ('allChanges');
    }
}, 1000);
