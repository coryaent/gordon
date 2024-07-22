"use strict";

console.log ('starting...');

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

    clearInterval (knownNodesWatch);

    let modifications = [];

    for (let node of garageNodes) {
        try {
            let swarmNode = await docker.getNode (node.hostname);
            swarmNode = await swarmNode.inspect ();
        } catch (error) {
            console.log ('error inspecting swarm node', node.hostname);
            process.exit (1);
        }

        let modification = {};
        modification.id = node.id

        let capacity = null;
        if (swarmNode.Spec.Labels[process.env.GORDON_CAPACITY_LABEL] != "null") {
            capacity = Number.parseInt (swarmNode.Spec.Labels[process.env.GORDON_CAPACITY_LABEL]);
        }
        modification.capacity = capacity;

        modification.zone = swarmNode.Spec.Labels[process.env.GORDON_ZONE_LABEL];

        let tags = undefined;
        if (swarmNode.Spec.Labels[process.env.GORDON_TAGS_LABEL]) {
            tags = JSON.parse (swarmNode.Spec.Labels[process.env.GORDON_TAGS_LABEL]).split (',');
        }
        modification.tags = tags ? tags : [];

        modifications.push (modification);
    }

    try {
        let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify (modifications)
        });
    } catch (error) {
        console.log ('error staging layout modifications:', error.message);
        process.exit (1);
    }

    if (response.status != 200) {
        console.log ('error staging layout modifications:', response.statusText);
        process.exit (1);
    }
})
.once ('allChanges', async () => {

    clearInterval (changesWatch);

    try {
        let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
            headers: headers
        });
    } catch (error) {
        console.log ('error fetching layout version:', error.message);
        process.exit (1);
    }
    if (response.status == 200) {
        response = await response.json ();
        let version = response.version + 1;

        try {
            await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify (
                    {
                        version: version
                    })
            });
        } catch (error) {
            console.log ('error applying layout:', error.message);
            process.exit (1);
        }
    } else {
        console.log ('error applying layout:', response.statusText);
        process.exit (1);
    }

    console.log ("success!");
    process.exit (0);
});

let knownNodesWatch = setInterval (async () => {
    try {
        let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/status`, {
            headers: headers
        });
    } catch (error) {
        console.log ('error fetching status:', error.message);
        return;
    }
    if (response.status == 200) {
        response = await response.json ();
        let upNodes = 0;
        for (let node of response.nodes) {
            if (node.isUp) {
                upNodes++;
            }
        }
        console.log (`found ${upNodes}/${process.env.GORDON_EXPECTED_NODE_COUNT} garage nodes`);
        if (upNodes == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
            garageEvents.emit ('allNodes', response.nodes);
        }
    } else {
        console.log ("error fetching status:", response.statusText);
    }
}, 2500);

let changesWatch = setInterval (async () => {
    try {
        let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
            headers: headers
        });
    } catch (error) {
        console.log ('error fetching layout changes:', error.message);
        return;
    }
    if (response.status == 200) {
        response = await response.json ();
        let numChanges = response.stagedRoleChanges.length;
        console.log (`found ${numChanges}/${process.env.GORDON_EXPECTED_NODE_COUNT} staged changes`);
        if (numChanges == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
            garageEvents.emit ('allChanges');
        }
    } else {
        console.log ("error fetching layout changes:", response.statusText);
    }
}, 2500);
