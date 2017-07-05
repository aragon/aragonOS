pragma solidity ^0.4.8;                                                         

contract AccountingApp {
    
    // The concept of sending tokens from one address to another
    struct Transaction {
        address token;
        int value;
        address baseToken;
        address baseValue;
        
        address from;
        address to;
        string reference;

        uint period;
        // Back reference the states?
        uint[] transactionStates;
    }    
    
    // initial idea for states 
    // TODO: draw out state machine
    enum TransactionState {
        New,
        Approved,
        Pending,
        Canceled,
        Failed,
        Succeeded
    }
        
    
    struct TransactionAction {
        uint transactionId;
        TransactionState state;
        string reason;
        address actor;
        uint timestamp; 
    }    
    
    // Audit trail of Actions that were performed on a Transation
    // For example ContractBob can initiate a transation to pay Eve for her invoice to Alice
    
    // 1) Make the new transation
    //  tid = Transation(value:3, token:Foo, from:Alice, to: Eve, reference: "invoice 123")
    // 
    
    // 2) Add the reason for the transation new state
    // aid = TransactionAction(transactionId: tid, state: New, reason:"new invoice", actor: ContractBob)
    // tid.transactionStates.push(aid)
    
    // 3) Add the reason for the transation new state
    // aid = TransactionAction(transactionId: tid, state: Approved, reason:"verified the invoice", actor: AdminSam)
    // tid.transactionStates.push(aid)
    
    // 3) Alice attemtps to with draw and now it's in the state where someone has a last chance to cancel it.
    // aid = TransactionAction(transactionId: tid, state: Pending, reason:"withdawing", actor: Alice)
    // tid.transactionStates.push(aid)
    
    // 5.a) Yay, Eve's address accepts this token!
    // aid = TransactionAction(transactionId: tid, state: Succeeded, reason:"", VaultOrgan)
    // tid.transactionStates.push(aid)
    
    // 5.b) Oh no, Eve's address doesn't accept this token!
    // aid = TransactionAction(transactionId: tid, state: Failed, reason:"token rejected", actor: VaultOrgan)
    // tid.transactionStates.push(aid)
    
    // 5.c) Wait, and admin canceled the transaction at the last moment
    // aid = TransactionAction(transactionId: tid, state: Canceled, reason:"This is a fake invoice", actor: SomeOtherAdmin)
    // tid.transactionStates.push(aid)

    function AccountingApp() {
        
    }
}
