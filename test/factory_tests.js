const Factory = artifacts.require("Factory")
const timeMachine = require('ganache-time-traveler');
contract("Factory", async accounts => {
    const MINTVALUE = "0.0001"
    const MAX_TOKENS = 1000
    let [creator,alice, bob] = accounts;
    let instance;
    const toBN = web3.utils.toBN
    beforeEach(async ()=>{
        instance = await Factory.deployed()

    });
    afterEach(async()=>{
       
    })
    xcontext("contract deployed", async () => {})
    context("User is minting context", async ()=>{
        // valid: draft open, value is enough, the token is mintable
        // invalid: draft closed, value is not enough, the token is not mintable
        // tokens minted array should have that value at end
        // collectibles minted should be +1
        it("should not mint when the draft is closed", async ()=>{
            // there is no draft by default
            try {
               let tx = await instance.mintToken(0, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
               assert.equal(false,true)

            } catch(e){
                
              assert.equal(e.reason,"Draft isnt open yet you can't mint")
            }
        })
        it("should not mint when value is not enough", async ()=>{
            // lets open draft
            
            await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})
            try {
               await instance.mintToken(0, {from: accounts[1], value: web3.utils.toWei("0.00001","ether")})
               assert.equal(false,true)
               
            }catch (e){
                assert.equal(e.reason,"Funds are not enough to mint")
            }
        })
        it("should not mint when the token is already minted", async()=>{
            try {
                await instance.mintToken(99, {from: accounts[6], value: web3.utils.toWei("0.0001","ether")})
                await instance.mintToken(99, {from: accounts[1], value: web3.utils.toWei("0.0001","ether")})
                assert.equal(false,true)
            }catch(e){

                assert.equal(e.reason, "Token is already minted")
            }
        })
        it("should not mint when the token ID is greater than max", async ()=>{
            try {
                tx = await instance.mintToken(BigInt(MAX_TOKENS + 10).toString(), {from: accounts[1], value: web3.utils.toWei("0.0001","ether")})
                assert.equal(tx.receipt.status,false)
            }catch(e){
                assert.equal(e.reason,"Token Id can not be greater than max collectibles range")
            }
        })
        it("should mint when the draft is open, value is enough and the token is mintable", async()=>{
            let tx;
            try {
                tx = await instance.mintToken(69, {from: accounts[1], value: web3.utils.toWei("0.0001","ether")})
                assert.equal(tx.receipt.status,true)
            }catch(e){
                assert.fail("It didn't mint the token successfully")
            }
        })
        
        
    })
    context("User's Collection Context", async ()=>{
        // single collectible ,6,9,5

        it("should get all of user's collectibles successfully", async ()=>{
            // arrange: mint 5 collectibles for the user
            // get their URIs and metaData
           try { 
               for (i = 0; i < 5; i++){
                    await instance.mintToken(i, {from:bob, value:web3.utils.toWei("0.001")})
               }
               receipts = await instance.getUserCollection(bob)
               for (i = 0; i < 5; i++){
                    assert.equal(""+i, receipts[i].tokenId)
                    }
           }catch (e){
                assert.equal(false, true)
           }

        })
        it("should return an empty array if the user has no collectibels", async()=>{
            let res = await instance.getUserCollection(accounts[9])
            assert(res, [])
        })
        it("should return currently auctioning collectibles of the user", async()=>{
        try {
            
            await instance.mintToken(21, {from:accounts[0], value:web3.utils.toWei("0.001")})
            await instance.mintToken(22, {from:accounts[0], value:web3.utils.toWei("0.001")})
            await instance.startAuction(21, BigInt(86400).toString(), web3.utils.toWei("0.01"), {from:accounts[0]} ) 
            await instance.startAuction(22, BigInt(86400).toString(), web3.utils.toWei("0.01"), {from:accounts[0]} ) 
            const tx = await instance.getUserAuctions(accounts[0])
            assert.equal(tx.length, 2)
            assert.equal(tx[0].tokenId, '21')    
            assert.equal(tx[1].tokenId, '22')
        }catch(e){
            console.log(e)
            assert(false,true)
            }

        })
        // get auction 🔁
        it("should return an empty array if there are no auctioning collectibles for the current user", async()=>{
            try {
                await instance.mintToken(666, {from:accounts[5], value:web3.utils.toWei("0.001")})
                const tx = await instance.getUserAuctions(accounts[5])
                
                assert.equal(tx.length, 0)
            }catch(e){
                console.log(e)
                assert(false,true)
            }

        })
        
    })
    context("User's Auction Context", async ()=>{
        // tokens 100+, accounts 2,3 fresh?
        it("should not make an auction for a token that the user doesn't own", async ()=>{
            // arrange, make 
            try{
                await timeMachine.advanceTimeAndBlock(3800)
                await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})

                await instance.mintToken(100, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(100, BigInt(3600).toString(), web3.utils.toWei("0.01"), {from:accounts[1]} ) 
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason,"You don't own this token, you can only call this function on tokens you own");
            }

        })
        it("should not make an auction when an auction is already being open for that token", async ()=>{
            try {
                await instance.mintToken(101, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(101, BigInt(86400).toString(), web3.utils.toWei("0.01"), {from:accounts[0]} ) 
                await instance.startAuction(101, BigInt(86400).toString(), web3.utils.toWei("0.01"), {from:accounts[0]} ) 
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason,"There is already an auction in progress for this token")
            }
        })
        it("should not make an auction when auction price is zero", async()=>{
            try{
                await instance.mintToken(102, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(102, BigInt(86400).toString(), web3.utils.toWei("0"), {from:accounts[0]} ) 
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason, "Auction price can not be zero")
            }
        })
        it("should not make an auction when auction duration is less than 1 hour", async()=>{
            try{
                await instance.mintToken(103, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(103, BigInt(3599).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                assert(true, false)
            }catch(e){
                assert.equal(e.reason, "Auction duration can not less than 1 hour")
            }
        })
        // valid
        it("should make make the auction under valid conditions", async()=>{
            try{
                await instance.mintToken(104, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(104, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                const tx = await instance.getUserAuctions(accounts[0])
                assert.equal(tx[tx.length-1].tokenId, '104')
                
            }catch(e){
                assert.equal(true, false)
            }
        })
        // auction endsENNNDDD
        it("should not end the auction if the caller is not the owner", async()=>{
            try{
                await instance.mintToken(105, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(105, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await instance.endAuction(105, {from:accounts[1]});
                assert(true, false)

            } catch(e){
                assert.equal(e.reason, "You don't own this token, you can only call this function on tokens you own")
            }
        })
        

        it("should not end the auction before the auction duration expires", async()=>{
            try{
                await instance.mintToken(106, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(106, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await instance.endAuction(106, {from:accounts[0]});
                assert.equal(true, false)
            } catch(e){
                assert.equal(e.reason, "Auction is not ended yet")

            }

        })
        it("should not end the auction if the auction is already not started for the token (confirm exception)", async()=>{
            try{
                await instance.mintToken(107, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.endAuction(107, {from:accounts[0]});
                assert.equal(true, false)

            } catch(e){
                assert.equal(e.reason,"There is no auction in progress for this token")
            }
        })
        
        it("should successfully end Auction under valid conditions ( no bid)", async()=>{
                try{
                    await instance.mintToken(108, {from:accounts[0], value:web3.utils.toWei("0.001")})
                    await instance.startAuction(108, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                    await timeMachine.advanceTimeAndBlock(3800);
                    // make a bid (bids )
                    await instance.endAuction(108, {from:accounts[0]});
                    // asserts: if no error was thrown all good
                    assert.equal(true, true)
                }catch(e){
                    console.log(e)
                    assert.equal(false, true)
                }
        })

        
        it("should successfully end Auction under valid conditions ( bid)", async()=>{
            try{

                // arrange
                await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})

                await instance.mintToken(109, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(109, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                // make a bid (bids )
                // PRE CONDITIONS 👇
                const contractBalanceBefore = await web3.eth.getBalance(instance.address)
                const contractBalanceBeforeBN = await web3.utils.toBN(contractBalanceBefore)

                const amountInWei = web3.utils.toWei('1', "ether")
                const amountBN = await web3.utils.toBN(amountInWei)
                
                const oldOwnerBalanceBefore = await web3.eth.getBalance(accounts[0])
                const oldOwnerBalanceBeforeBN = await web3.utils.toBN(oldOwnerBalanceBefore)
                // PRE CONDITIONS 👆
                const tx = await instance.makeBid(109,{from:accounts[1], value:await web3.utils.toWei("1", "ether")} )
                await timeMachine.advanceTimeAndBlock(3800);

                // console.log(await web3.eth.getBalance(instance.address))
                const tx2 = await instance.endAuction(109, {from:accounts[0]});
                const gasBN = await toBN(""+tx2.receipt.gasUsed)
                const finalGasPrice = gasBN.mul(toBN(""+20000000000))
                // assert contract balance  (before the bid and after bid end should equal)
                assert.equal(await web3.eth.getBalance(instance.address),contractBalanceBeforeBN.add(amountBN.mul(await toBN(1)).div(await toBN(5))).toString())
                //assert funds transfer oldOwner has more money now  (80% of what token was sold for)
                assert.equal(await web3.eth.getBalance(accounts[0]), oldOwnerBalanceBeforeBN.sub(finalGasPrice).add(amountBN.mul(await toBN(4)).div(await toBN(5))).toString() )
                // // assert ownership transfer
                assert.equal(await instance.ownerOf(109), accounts[1])
                
                assert.equal(true, true)
            }catch(e){
                console.log(e)
                assert.equal(false, true)
            }
    
    
        })
        it("should not make a bid if the auction is not open for the token", async()=>{
            try{
                await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})

                await instance.mintToken(110, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.makeBid(110, {from:accounts[1], value:web3.utils.toWei("0.1")})
                assert.equal(true,false)
            }catch(e){
                assert.equal(e.reason, "There is no auction in progress for this token")
            }
        })
        it("should not be able to make a bid once the auction time has passed", async()=>{
            try {

            await instance.mintToken(111, {from:accounts[0], value:web3.utils.toWei("0.001")})
            await instance.startAuction(111, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
            await timeMachine.advanceTimeAndBlock(3800);
            await instance.makeBid(111, {from:accounts[1], value:web3.utils.toWei("0.1")})
            assert.equal(true, false)
        }catch(e){
            assert.equal(e.reason, "Auction is ended you can not bid")
            }

        })
        it("should not make the bid if the owner is making the bid", async()=>{
            try {
                await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})

                await instance.mintToken(112, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(112, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await timeMachine.advanceTimeAndBlock(3500);
                await instance.makeBid(112, {from:accounts[0], value:web3.utils.toWei("0.1")})
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason, "You are the owner of this token, you can not call this function")
                }
        })
        it("should not make the bid if the amount is less than the highest bid", async()=>{
            try {
                await timeMachine.advanceTimeAndBlock(3600)
                await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})

                await instance.mintToken(113, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(113, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await timeMachine.advanceTimeAndBlock(3500);
                await instance.makeBid(113, {from:accounts[1], value:web3.utils.toWei("0.001")})
                await instance.makeBid(113, {from:accounts[2], value:web3.utils.toWei("0.0001")})
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason,  "Your bid is lower that the current highest")
                }
        })
        it("should not make the bid if the amount is less than the minimum bidding amount", async()=>{
            try {
                await instance.mintToken(114, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(114, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await timeMachine.advanceTimeAndBlock(3500);
                await instance.makeBid(114, {from:accounts[1], value:web3.utils.toWei("0.00009")})
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason,  "Bid amount is less than the minimum bid price")
                }
        })

        it("should make a bid if above conditions have been passed (valid conditions", async()=>{
            try {
                await instance.startDraft(BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:creator})

                await instance.mintToken(115, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(115, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await timeMachine.advanceTimeAndBlock(3500);
                const tx = await instance.makeBid(115, {from:accounts[1], value:web3.utils.toWei("0.00011")})
                assert.equal(tx.logs[0].event,"BidPlaced")
            }catch(e){
                console.log(e)
                assert.equal(true, false)
            }
        })
        it("should have its money returned if another higher bid takes its place (other)", async()=>{
            try {
                await instance.mintToken(116, {from:accounts[0], value:web3.utils.toWei("0.001")})
                await instance.startAuction(116, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[0]} ) 
                await timeMachine.advanceTimeAndBlock(3500);
                // PRE
                const accountPriceBefore = await web3.eth.getBalance(accounts[2])  
                const accountPriceBeforeBN = await web3.utils.toBN(accountPriceBefore)
                const amountInWei = web3.utils.toWei('1', "ether")
                const amountBN = await web3.utils.toBN(amountInWei)
                const tx = await instance.makeBid(116, {from:accounts[2], value:web3.utils.toWei("1")})
                await instance.makeBid(116, {from:accounts[3], value:web3.utils.toWei("2")})
                // REFACT
                const gasBN = await toBN(""+tx.receipt.gasUsed)
                const finalGasPrice = gasBN.mul(toBN(""+20000000000))
                const accountPriceAfter = await web3.eth.getBalance(accounts[2])  
                const accountPriceAfterBN = await web3.utils.toBN(accountPriceAfter)
                assert.equal(accountPriceAfterBN.toString(), accountPriceBeforeBN.sub(finalGasPrice).toString() )
                // // assert ownership transfer
            }catch(e){
                console.log(e)
                assert.equal(true,false)
                }
        })
        
    })

    context("Owner's Draft Context", async()=>{
        it("should not start a new draft if the caller is not an owner", async()=>{
            try {
                // accounts 0 is the owner
                timeMachine.advanceTimeAndBlock(3600)
                await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.01"), {from:accounts[1]})
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason, "Ownable: caller is not the owner")
            }
        })
        it("should not start a new draft if the duration is less than 1 hour", async()=>{
            try {
                // accounts 0 is the owner
                await instance.startDraft(BigInt("3599").toString(), web3.utils.toWei("0.01"), {from:accounts[0]})
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason, "Draft duration must be at least 1 hour")
            }
        })

        it("should not start a new draft is a draft is already underway", async()=>{
            try {
                // accounts 0 is the owner
                await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.01"), {from:accounts[0]})
                await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.01"), {from:accounts[0]})
                assert.equal(true, false)
            }catch(e){
                assert.equal(e.reason, "There is a draft in progress")
            }
        })
        it("should start a draft under above valid conditions", async()=>{
            try {
                // accounts 0 is the owner
                await timeMachine.advanceTimeAndBlock(3600)
                const tx = await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.01"), {from:accounts[0]})
                assert.equal(tx.receipt.status, true)
                
            }catch(e){
                assert.equal(true, false)
            }
        })
        it("should not mint after the draft has ended", async()=>{
            try {
                // accounts 0 is the owner
                await timeMachine.advanceTimeAndBlock(3600)
                const tx = await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.01"), {from:accounts[0]})
                await timeMachine.advanceTimeAndBlock(3800)
                await instance.mintToken(901,{from: accounts[0] , value:web3.utils.toWei("0.01")} )
                assert.equal(false, true)
                
            }catch(e){
                assert.equal("Draft isnt open yet you can't mint",e.reason)
            }
        })
        // the user can indeed enter 

    })
    context("Owner's funds context", async()=>{
        it("should only withdraw funds that are non escrow", async()=>{
            // arrange
            // make a lot of bids for different tokens
            // end auction for one and withdraw... the amount should be 20% of that transaction only (-gas)
            try {
                await timeMachine.advanceTimeAndBlock(3600)
                // start draft
                await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.001"), {from:accounts[0]})
                  // mint two tokens 
                await instance.mintToken(400, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
                await instance.mintToken(401, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
                // create 2 auctions
                await instance.startAuction(400, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[1]} ) 
                await instance.startAuction(401, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[1]} ) 
                // make 2 bids (this will create sums of two escrows)
                await instance.makeBid(400, {from:accounts[2], value:web3.utils.toWei("1")})
                await instance.makeBid(401, {from:accounts[2], value:web3.utils.toWei("2")})
                // end auction for token 1
                await timeMachine.advanceTimeAndBlock(3600)
                await instance.endAuction(401,  {from:accounts[1]})
                // this will send funds to accounts 1 and transfer owner ship
                // now try withdrawing funds (should  only get 0.5)
                await instance.withdrawFunds( {from:accounts[0]})
                await instance.endAuction(400,  {from:accounts[1]})
                await instance.withdrawFunds( {from:accounts[0]})

            
                assert.equal(true, true)

            }catch(e){
                console.log(e)
                assert.equal(false, true)
            }


        })
        it("should revert when there are no funds to withdraw", async()=>{
            try{
            await instance.withdrawFunds( {from:accounts[0]})
            assert.equal(true, false)
            }catch(e){
                assert.equal("No funds to withdraw", e.reason)
            }

        })
        it("should return how many funds there are to withdraw", async()=>{
            try {
                await timeMachine.advanceTimeAndBlock(3600)
                // start draft
                await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.001"), {from:accounts[0]})
                  // mint two tokens 
                await instance.mintToken(410, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
                await instance.mintToken(411, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
                // create 2 auctions
                await instance.startAuction(410, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[1]} ) 
                await instance.startAuction(411, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[1]} ) 
                // make 2 bids (this will create sums of two escrows)
                await instance.makeBid(410, {from:accounts[2], value:web3.utils.toWei("1")})
                await instance.makeBid(411, {from:accounts[2], value:web3.utils.toWei("2")})
                // end auction for token 1
                await timeMachine.advanceTimeAndBlock(3600)
                await instance.endAuction(411,  {from:accounts[1]})
                // this will send funds to accounts 1 and transfer owner ship
                // now try withdrawing funds (should  only get 0.5)
                await instance.endAuction(410,  {from:accounts[1]})
                const tx = await instance.getWithdrawAmount({from:accounts[0]})                   
                assert(tx.gt(toBN(web3.utils.toWei("0.6"))))

            }catch(e){
                console.log(e)
                assert.equal(false, true)
            }
        })
    })
    context("Owner's Stats", async()=>{

        it("should return collectibles sold", async()=>{
            try{
            const tx = await instance.collectiblesMinted()
            console.log(tx.toString())
            assert(tx.gt(toBN("0")))
            }catch(e){
                console.log(e)
                assert.equal(false, true)
            }
        })
        it("should return all the collectibles currently on auction", async()=>{
            try{
                // make auctions
                // make some bids
                await timeMachine.advanceTimeAndBlock(3600)
                // start draft
                await instance.startDraft(BigInt("3600").toString(), web3.utils.toWei("0.001"), {from:accounts[0]})
                  // mint two tokens 
                await instance.mintToken(510, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
                await instance.mintToken(511, {from: accounts[1], value: web3.utils.toWei("0.001","ether")})
                // create 2 auctions
                await instance.startAuction(510, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[1]} ) 
                await instance.startAuction(511, BigInt(3600).toString(), web3.utils.toWei("0.0001"), {from:accounts[1]} ) 
                // make 2 bids (this will create sums of two escrows)
                await instance.makeBid(510, {from:accounts[2], value:web3.utils.toWei("1")})
                await instance.makeBid(511, {from:accounts[2], value:web3.utils.toWei("2")})
                
                const tx = await instance.getAllAuctions()
             
                assert.equal(tx.length ,14)


            }catch(e){
                console.log(e)
                assert.equal(true, false)
            }
        })


    })


    
})