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

// 1. check for all nodes
// 2. log each new node number i.e. only print 1/7, 2/7, etc.
// 3. stop checking for new nodes
// 4. get layout options from docker
// 5. stage and apply the layout

var foundAllNodes = false;
var foundNodes = 0;

const garageEvents = new EventEmitter ()
// called once all nodes have been found
.once ('allNodes', async (garageNodes) => {

    foundAllNodes = true;

    clearInterval (knownNodesWatch);

    let modifications = [];

    // read the docker labels for each of the garage nodes
    for (let node of garageNodes) {
        try {
            var swarmNode = await docker.getNode (node.hostname);
            console.log ('got node', node.hostname);
            swarmNode = await swarmNode.inspect ();
            console.log ('got node', node.hostname, 'details');
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

    // stage the layout modifications
    try {
        var response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
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
// called once all changes have been staged
.once ('allChanges', async () => {

    // stop watching for changes, they have all been found
    clearInterval (changesWatch);

    // get the layout version
    try {
        var response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
            headers: headers
        });
    } catch (error) {
        console.log ('error fetching layout version:', error.message);
        process.exit (1);
    }

    // increment the layout version and apply the changes
    if (response.status == 200) {
        response = await response.json ();
        let version = response.version + 1;

        try {
            var application = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout/apply`, {
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
        if (application.status == 200) {
            console.log ("success!");
            process.exit (0);
        } else {
            console.log ('error applying layout:', application.statusText);
            process.exit (1);
        }
    } else {
        console.log ('error fetching layout version:', response.statusText);
        process.exit (1);
    }

});

// this checks the status of the cluster before any changes have been staged
let knownNodesWatch = setInterval (async () => {

    // fetch the status (includes number of peer nodes)
    try {
        var response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/status`, {
            headers: headers
        });
    } catch (error) {
        console.log ('error fetching status:', error.message);
        return;
    }

    // check that the status was fetched correctly
    if (response.status == 200) {
        // parse the response as json
        response = await response.json ();
        // start the nodes count at 0
        let upNodes = 0;
        // check that nodes are up
        for (let node of response.nodes) {
            // check that the node is legitimately up
            if (node.isUp && node.hostname) {
                // increment the number of nodes
                upNodes++;
            }
        }
        // found nodes is a "global" variable that keeps the logs clean by ignoring a lack of updates
        // if we have more nodes up than we have acknowledged as found (there will always be at least one up)
        // the node counts itself as healthy and available, so the number of up nodes will start at one
        if (upNodes > foundNodes) {
            console.log (`found ${upNodes}/${process.env.GORDON_EXPECTED_NODE_COUNT} garage nodes`);
            foundNodes = upNodes;
        }
        // all the nodes have been found
        if (upNodes == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
            garageEvents.emit ('allNodes', response.nodes);
        }
    } else {
        console.log ("error fetching status:", response.statusText);
    }
}, 2500);

// this watches the cluster for the number of staged changes
let changesWatch = setInterval (async () => {

    // no need to do anything if all nodes have not been found
    // there will be no changes staged
    if (!foundAllNodes) {
        return;
    }

    // check the layout for staged changes
    try {
        var response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/layout`, {
            headers: headers
        });
    } catch (error) {
        console.log ('error fetching layout changes:', error.message);
        return;
    }

    if (response.status == 200) {
        // parse the response
        response = await response.json ();

        // the number of roles is equal to the number of applied changes
        let numRoles = response.roles.length;
        if (numRoles == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
            console.log (`found ${numRoles}/${process.env.GORDON_EXPECTED_NODE_COUNT} roles`);
            console.log ('already initialized');
            garageEvents.removeAllListeners ();
            process.exit (0);
        }

        // che number of changes is equal to the number of staged or proposed layout changes
        let numChanges = response.stagedRoleChanges.length;
        // this should generally be equal to the number of expected nodes
        // because all the changes are staged in one fetch
        console.log (`found ${numChanges}/${process.env.GORDON_EXPECTED_NODE_COUNT} staged changes`);
        if (numChanges == Number.parseInt (process.env.GORDON_EXPECTED_NODE_COUNT)) {
            // trigger the application of changes
            garageEvents.emit ('allChanges');
        }
    } else {
        console.log ("error fetching layout changes:", response.statusText);
    }
}, 2500);
