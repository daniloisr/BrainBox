/**
 * @page AtlasMaker: WebSockets
 */
var AtlasMakerWS = {
	//====================================================================================
	// Web sockets
	//====================================================================================
    /**
     * @function createSocket
     */
	createSocket: function createSocket(host) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(createSocket);if(l)console.log(l);
	
		var ws;

		if (window.WebSocket) {
			ws=new WebSocket(host);
		} else if (window.MozWebSocket) {
			ws=new MozWebSocket(host);
		}

		return ws;
	},
	 /**
     * @function initSocketConnection
     */
	initSocketConnection: function initSocketConnection() {
		var me=AtlasMakerWidget;
		var l=me.traceLog(initSocketConnection);if(l)console.log(l);
			
		var def=$.Deferred();
	
		// WS connection
		var host = "ws://" + window.location.hostname + ":8080/";
		
		if(me.debug)
			console.log("[initSocketConnection] host:",host);
		if (me.progress)
			me.progress.html("Connecting...");
		
		try {
			me.socket = me.createSocket(host);
			
			me.socket.onopen = function(msg) {
				if(me.debug)
					console.log("[initSocketConnection] connection open",msg);
				me.progress.html("<img src='/img/download.svg' style='vertical-align:middle'/>MRI");
				$("#chat").text("Chat (1 connected)");
				me.flagConnected=1;
				def.resolve();
			};
			
			me.socket.onmessage = me.receiveSocketMessage;
			
			me.socket.onclose = function(msg) {
				me.socket.send(JSON.stringify({
					"type":"echo",
					"msg":"user socket closing",
					"username":me.User.username
				}));
				$("#chat").text("Chat (disconnected)");
				me.flagConnected=0;
			};
		}
		catch (ex) {
			$("#chat").text("Chat (not connected - connection error)");
		}
		
		return def.promise();
	},
	/**
     * @function receiveSocketMessage
     */
	receiveSocketMessage: function receiveSocketMessage(msg) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receiveSocketMessage,1);if(l)console.log(l);

		// Message: atlas data initialisation
		if(msg.data instanceof Blob) {
		    me.receiveBinaryMessage(msg.data);
			return;
		}
	
		// Message: interaction message
		var	data=JSON.parse(msg.data);
	
		// [deprecated]
		// If we receive a message from an unknown user,
		// send our own data to make us known
		// [now, the server does the introductions]
		/*
		if(data.uid!=undefined && !Collab[data.uid]) {
			console.log("Received message from unknown user");
			sendUserDataMessage("introduce to new user");
		}
		*/
	
		switch(data.type) {
			case "saveMetadata" :
				me.receiveMetaData(data);
				break;
			case "userData":
				me.receiveUserDataMessage(data);
				break;
			case "volInfo":
				console.log("volInfo",data);
				break;
			case "chat":
				me.receiveChatMessage(data);
				break;
			case "paint":
				me.receivePaintMessage(data);
				break;
			case "paintvol":
				me.receivePaintVolumeMessage(data);
				break;
			case "disconnect":
				me.receiveDisconnectMessage(data);
				break;
		}
	},
	/**
     * @function sendUserDataMessage
     */
	sendUserDataMessage: function sendUserDataMessage(description) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(sendUserDataMessage,1);if(l)console.log(l);

		if(me.flagConnected==0)
			return;

		if(me.debug>1) console.log("message: "+description);
		
		if(description === "allUserData")
    		var msg={"type":"userData","user":me.User,"description":description};
    	else
    		var msg={"type":"userData","description":description};
		try {
			me.socket.send(JSON.stringify(msg));
		} catch (ex) {
			console.log("ERROR: Unable to sendUserDataMessage",ex);
		}
	},
	/**
     * @function receiveBinaryMessage
     */
	receiveBinaryMessage: function receiveBinaryMessage(msgData) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receiveBinaryMessage,1);if(l)console.log(l);
		
        var fileReader = new FileReader();
        fileReader.onload = function from_receiveSocketMessage() {
            var data=new Uint8Array(this.result);
            var sz=data.length;
            var ext=String.fromCharCode(data[sz-8],data[sz-7],data[sz-6]);

            if(me.debug>1) console.log("type: "+ext);
            
            switch(ext) {
                case 'nii': {
                    var	inflate=new pako.Inflate();
                    inflate.push(data,true);
                    var atlas=new Object();
                    atlas.data=inflate.result;
                    atlas.name=me.atlasFilename;
                    atlas.dim=me.brain_dim;
            
                    me.atlas=atlas;

                    me.configureBrainImage();
                    me.configureAtlasImage();
                    me.resizeWindow();

                    me.brain_img.img=null;
                    me.drawImages();
                    
                    // compute total segmented volume
                    var vol=me.computeSegmentedVolume();
                    me.info.volume=parseInt(vol)+" mm3";

                    // setup download link
                    var	link=me.container.find("span#download_atlas");
                    link.html("<a class='download' href='"+me.User.dirname+me.User.atlasFilename+"'><img src='/img/download.svg' style='vertical-align:middle'/></a>"+atlas.name);
                    break;
                }
                case 'jpg': {
                    var urlCreator = window.URL || window.webkitURL;
                    var imageUrl = urlCreator.createObjectURL(msgData);
                    var img = new Image();
                    
                    me.isMRILoaded=true; // receiving a jpg is proof of a loaded MRI
                    
                    img.onload=function from_initSocketConnection(){
                        var flagFirstImage=(me.brain_img.img==null);
                        me.brain_img.img=img;
                        me.brain_img.view=me.flagLoadingImg.view;
                        me.brain_img.slice=me.flagLoadingImg.slice;

                        me.drawImages();
                                                            
                        me.flagLoadingImg.loading=false;

                        if(flagFirstImage || me.flagLoadingImg.view!=me.User.view ||me.flagLoadingImg.slice!=me.User.slice) {
                            me.sendRequestSliceMessage();
                        }
                        
                        // remove loading indicator
                        $("#loadingIndicator").hide();
                    }
                    img.src=imageUrl;
                    
                    break;
                }
            }
        };
        fileReader.readAsArrayBuffer(msgData);
	},
	/**
     * @function receiveUserDataMessage
     */
	receiveUserDataMessage: function receiveUserDataMessage(data) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receiveUserDataMessage);if(l)console.log(l);

		if(me.debug) console.log("description: "+data.description,data);
	
		var u=data.uid;
	
		// First time the user is observed
		if(me.Collab[u]===undefined) {
			try {
				//var	msg="<b>"+data.user.username+"</b> entered atlas "+data.user.specimenName+"/"+data.user.atlasFilename+"<br />"
				var	msg="<b>"+data.user.username+"</b> entered<br />"
				$("#log").append(msg);
				$("#log").scrollTop($("#log")[0].scrollHeight);
			} catch (e) {
				console.log(e);
			}
		}
		
		if(data.description === "allUserData")
    		me.Collab[u]=data.user;
    	else {
    	    try {
                var changes = JSON.parse(data.description);
                var i;
                for(i in changes)
                    me.Collab[u][i] = changes[i];
            } catch (e) {
                console.log(e);
            }
    	}

		var	v,nusers=1; for(v in me.Collab) nusers++;
		$("#chat").text("Chat ("+nusers+" connected)");
	},
	/**
     * @function sendChatMessage
     */
	sendChatMessage: function sendChatMessage() {
		var me=AtlasMakerWidget;
		var l=me.traceLog(sendChatMessage);if(l)console.log(l);
	
		if(me.flagConnected==0)
			return;
		var msg = DOMPurify.sanitize($('input#msg')[0].value);
		try {
			me.socket.send(JSON.stringify({"type":"chat","msg":msg,"username":me.User.username}));
			var	msg="<b>me: </b>"+msg+"<br />";
			$("#log").append(msg);
			$("#log").scrollTop($("#log")[0].scrollHeight);
			$('input#msg').val("");
		} catch (ex) {
			console.log("ERROR: Unable to sendChatMessage",ex);
		}
	},
	/**
     * @function receiveChatMessage
     */
	receiveChatMessage: function receiveChatMessage(data) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receiveChatMessage);if(l)console.log(l);
		console.log(data);
	
		var	theView=me.Collab[data.uid].view;
		var	theSlice=me.Collab[data.uid].slice;
		var theUsername=data.username;
		var	msg="<b>"+theUsername+" ("+theView+" "+theSlice+"): </b>"+data.msg+"<br />"
		$("#log").append(msg);
		$("#log").scrollTop($("#log")[0].scrollHeight);
	},
	/**
     * @function sendPaintMessage
     */
	sendPaintMessage: function sendPaintMessage(msg) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(sendPaintMessage,1);if(l)console.log(l);
	
		if(me.flagConnected==0)
			return;
		try {
			me.socket.send(JSON.stringify({type:"paint",data:msg}));
		} catch (ex) {
			console.log("ERROR: Unable to sendPaintMessage",ex);
		}
	},
	/**
     * @function receivePaintMessage
     */
	receivePaintMessage: function receivePaintMessage(data) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receivePaintMessage,3);if(l)console.log(l);
	
		var	msg=data.data;
		var u=data.uid;	// user
		var c=msg.c;	// command
		var x=parseInt(msg.x);	// x coordinate
		var y=parseInt(msg.y);	// y coordinate

		me.paintxy(u,c,x,y,me.Collab[u]);
	},
	/**
     * @function receivePaintVolumeMessage
     */
	receivePaintVolumeMessage: function receivePaintVolumeMessage(data) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receivePaintVolumeMessage);if(l)console.log(l);
	
		var	i,ind,val,voxels;
	
		voxels=data.data;
		me.paintvol(voxels.data);
	},
	 /**
     * @function sendUndoMessage
     */
	sendUndoMessage: function sendUndoMessage() {
		var me=AtlasMakerWidget;
		var l=me.traceLog(sendUndoMessage);if(l)console.log(l);
	
		if(me.flagConnected==0)
			return;
		try {
			me.socket.send(JSON.stringify({type:"paint",data:{c:"u"}}));
		} catch (ex) {
			console.log("ERROR: Unable to sendUndoMessage",ex);
		}
	},
	/**
     * @function sendRequestSliceMessage
     */
	sendRequestSliceMessage: function sendRequestSliceMessage() {
		var me=AtlasMakerWidget;
		var l=me.traceLog(sendRequestSliceMessage,1);if(l)console.log(l);

		if(me.flagConnected==0)
			return;
		if(me.flagLoadingImg.loading==true)
			return;
		try {
			me.socket.send(JSON.stringify({
				type:"requestSlice",
				view:me.User.view,
				slice:me.User.slice
			}));
			me.flagLoadingImg.loading=true;
			me.flagLoadingImg.view=me.User.view;
			me.flagLoadingImg.slice=me.User.slice;

		} catch (ex) {
			console.log("ERROR: Unable to sendRequestSliceMessage",ex);
		}
	},
	receiveMetaData: function receiveMetaData(data) {
// 		console.log(info_proxy);
// 		console.log(info_proxy.files);
		for (var i in projectInfo.files.list) {
			if (projectInfo.files.list[i].source == data.metadata.source) {
				for (var key in projectInfo.files.list[i].mri.annotations) {
					info_proxy["files.list." + i + ".mri.annotations." + key] = data.metadata.mri.annotations[key];
				}
				info_proxy["files.list." + i + ".name"] = data.metadata.name;
				break;
			}
		}
		console.log("JUST RECIEVED SOME MORE DATA", data.metadata);
	},
	/**
     * @function sendSaveMetadataMessage
     */
	sendSaveMetadataMessage: function sendSaveMetadataMessage(info) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(sendSaveMetadataMessage,1);if(l)console.log(l);
			
		if(me.flagConnected==0)
			return;
		try {
			me.socket.send(JSON.stringify({type:"saveMetadata",metadata:info}));
		} catch (ex) {
			console.log("ERROR: Unable to sendSaveMetadataMessage",ex);
		}
	},
	/**
     * @function receiveDisconnectMessage
     */
	receiveDisconnectMessage: function receiveDisconnectMessage(data) {
		var me=AtlasMakerWidget;
		var l=me.traceLog(receiveDisconnectMessage);if(l)console.log(l);

		var u=data.uid;	// user
		//var	msg="<b>"+me.Collab[u].username+"</b> left atlas "+me.Collab[u].specimenName+"/"+me.Collab[u].atlasFilename+"<br />"
		var	msg="<b>"+me.Collab[u].username+"</b> left<br />"
		me.Collab.splice(u,1);
		var	v,nusers=1; for(v in me.Collab) nusers++;
		$("#chat").text("Chat ("+nusers+" connected)");
		$("#log").append(msg);
		$("#log").scrollTop($("#log")[0].scrollHeight);
	}
}