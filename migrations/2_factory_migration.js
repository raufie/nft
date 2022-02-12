const Factory = artifacts.require("Factory")
module.exports = function(deployer,network, accounts){
   deployer.deploy(Factory, accounts[0], BigInt("1000"), "Idiots", "IDT",BigInt(web3.utils.toWei("0.0001", "ether")  )
   ,{
      from:accounts[0],
   
   })   
   
}