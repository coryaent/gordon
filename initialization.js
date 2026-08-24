"use strict";

const fs = require("node:fs");
const Docker = require("dockerode");
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// no arguments to dockerode means this must run on a manager with /var/run/docker.sock mounted
const docker = new Docker();

module.exports = {
  initialize: async function(options) {
    // read admin token if the user passed it as a file
    const adminToken = options.adminToken || fs.readFileSync(options.tokenFile).toString().trim();
    // bail if there is no admin token
    if (!adminToken) {
      console.error('No admin token specified.');
      process.exit(1);
    }

    // http headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // declare here to avoid worries about scope
    let response, result;

    // find the nodes
    let numUpNodes = 0;
    while(numUpNodes < options.numNodes) {

      // get the cluster status from the v2 API
      response = await fetch(`${options.endpoint}/v2/GetClusterStatus`, { 'headers': headers });

      // result contains the discovered nodes
      result = await response.json();
      if (options.debug) console.debug('result:', result);

      // only count nodes that are up
      numUpNodes = result.nodes.filter(node => node.isUp).length;

      // show status
      console.log('found', numUpNodes, 'out of', options.numNodes, 'nodes');

      // wait so that more nodes can be discovered
      await sleep(2500);
    }

    // now we have all the nodes
    let garageNodes = result.nodes;
    if (options.debug) console.debug('garageNodes:', garageNodes);

    // the layout changes that will be applied
    let roleChanges = [];
    // loop over the garage nodes to get the swarm nodes
    for (let node of garageNodes) {
      // output the hostname of the current iteration
      if (options.debug) console.debug('garageNode:', node.hostname);

      // get the swarm node from the garage node hostname
      let swarmNode = await docker.getNode(node.hostname);
      if (options.debug) console.debug('got swarm node', node.hostname);
      
      // get the swarm node's details
      swarmNode = await swarmNode.inspect();

      // a modification for a specific node
      let modification = {};
      // specify the Garage node id
      modification.id = node.id;

      // calculate the capacity
      // 'null' is passed as a string in the commander/function options and the swarm node label
      // Number.parseInt('null') returns NaN and NaN || null returns null
      modification.capacity = Number.parseInt(swarmNode.Spec.Labels[options.capacityLabel]) || null;

      // get the tags (if there are any, default to an empty array)
      // --tags-label is not a required option
      modification.tags = options.tagsLabel ? swarmNode.Spec.Labels[options.tagsLabel].split(',') : [];

      // set the zone
      modification.zone = swarmNode.Spec.Labels[options.zoneLabel];

      // add this modification to the array of modifications
      roleChanges.push(modification);
    }

    // send request to update cluster layout
    response = await fetch(`${options.endpoint}/v2/UpdateClusterLayout`,
    {
      'method': "POST",
      'headers': headers,
      'body': {
        'parameters': {},
        'roles': roleChanges
      }
    });

    // parse the response in order to get the cluster version
    result = await response.json();

    // increment the layout version
    let layoutVersion = result.version + 1;

    response = await fetch(`${options.endpoint}/v2/ApplyClusterLayout`, {
      'version': layoutVersion
    });

    // parse the response to get the message
    result = await response.json();

    // print the response message to the console
    console.log(result.message[0]);
  }
};
