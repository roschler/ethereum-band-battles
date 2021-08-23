// Abstract contracts like 'Context', 'Ownable' and Pausable are not deployed.
// const ContextContract = artifacts.require("Context");
// const OwnableContract = artifacts.require("Ownable");
const PausableContract = artifacts.require("Pausable");
const SafeMathContract = artifacts.require("SafeMath");
const EBBContract = artifacts.require("EtherBandBattlesManager");

module.exports = function(deployer) {
	// Abstract contracts like 'Context', 'Ownable' and Pausable are not deployed.
	// deployer.deploy(ContextContract);
	// deployer.deploy(OwnableContract);
	// deployer.deploy(PausableContract);
	deployer.deploy(SafeMathContract);
	deployer.deploy(EBBContract);
}
