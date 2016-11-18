/**
 * @library BrainBox
 * @version 0.0.1
 * @brief Real-time collaboration in neuroimaging
 */
 
/**
 * @page BrainBox
 */

var BrainBox={
	version: 1,
	debug: 1,
	info:{},
	labelSets:null,
	annotationType:["volume","text"],

    /**
     * @function traceLog
     */
	traceLog: function traceLog(f,l) {
	/*
		if(BrainBox.debug && (l==undefined || BrainBox.debug>l))
			// return "bb> "+(f.name)+" "+(f.caller?(f.caller.name||"annonymous"):"root");
			return "bb> ";//+(f.name);
	*/
	},

	/*
		JavaScript implementation of Java's hashCode method from
		http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
	*/
	/**
     * @function hash
     */
	hash: function hash(str) {
		var l=BrainBox.traceLog(hash);if(l)console.log(l);
		
		var v0=0,v1,abc="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
		for(i=0;i<str.length;i++) {
			ch=str.charCodeAt(i);
			v0=((v0<<5)-v0)+ch;
			v0=v0&v0;
		}
		var sz=abc.length,v,res="";
		for(i=0;i<8;i++) {
			v1=parseInt(v0/sz);
			v=Math.abs(v0-v1*sz);
			res+=abc[v];
			v0=v1;
		}
		return res;
	},
	/**
     * @function loadScript
     */
	loadScript: function loadScript(path) {
	    var def = new $.Deferred();
        var s = document.createElement("script");
        s.src = path;
        s.onload=function () {
            def.resolve();
        };
        document.body.appendChild(s);
    	return def.promise();
	},
	/**
     * @function initBrainBox
     */
	initBrainBox: function initBrainBox() {
		var l=BrainBox.traceLog(initBrainBox);if(l)console.log(l);
		
		var def=$.Deferred();

		// Add AtlasMaker and friends
		$("#stereotaxic").html('<div id="atlasMaker"></div>');
		$("#atlasMaker").addClass('edit-mode');
		
        $.when(
            BrainBox.loadScript('/js/atlasMaker-draw.js'),
            BrainBox.loadScript('/js/atlasMaker-interaction.js'),
            BrainBox.loadScript('/js/atlasMaker-io.js'),
            BrainBox.loadScript('/js/atlasMaker-paint.js'),
            BrainBox.loadScript('/js/atlasMaker-ui.js'),
            BrainBox.loadScript('/js/atlasMaker-ws.js'),
            BrainBox.loadScript('/js/atlasMaker.js')
        ).then(function () {
            $.extend(AtlasMakerWidget,AtlasMakerDraw);
            $.extend(AtlasMakerWidget,AtlasMakerInteraction);
            $.extend(AtlasMakerWidget,AtlasMakerIO);
            $.extend(AtlasMakerWidget,AtlasMakerPaint);
            $.extend(AtlasMakerWidget,AtlasMakerUI);
            $.extend(AtlasMakerWidget,AtlasMakerWS);
            AtlasMakerWidget.initAtlasMaker($("#atlasMaker"))
                .then(function() {
                    def.resolve();
                });
        });
		
		// store state on exit
		$(window).on('unload',BrainBox.unload);
		
		return def.promise();
	},
	/**
     * @function configureBrainBox
     */
	configureBrainBox: function configureBrainBox(param) {
		var l=BrainBox.traceLog(configureBrainBox);if(l)console.log(l);
		
		var def=$.Deferred();
		var date=new Date();
		var index=param.annotationItemIndex||0;
	
		// Copy MRI from source
		$("#msgLog").html("<p>Downloading from source to server...");

        // Configure MRI into atlasMaker
        if(param.info.success===false) {
            date=new Date();
            $("#msgLog").append("<p>ERROR: "+param.info.message+".");
            console.log("<p>ERROR: "+param.info.message+".");
            return def.promise().reject();
        }
        BrainBox.info=param.info;

        var arr=param.url.split("/");
        var name=arr[arr.length-1];
        date=new Date();
        $("#msgLog").append("<p>Downloading from server...");

        /**
         * @todo Check it these two lines are of any use...
         */
        param.dim=BrainBox.info.dim; // this allows to keep dim and pixdim through annotation changes
        param.pixdim=BrainBox.info.pixdim;

        // re-instance stored configuration
        var stored=localStorage.AtlasMaker;
        if(stored) {
            var stored=JSON.parse(stored);
            if(stored.version && stored.version==BrainBox.version) {
                for(var i=0;i<stored.history.length;i++) {
                    if(stored.history[i].url==param.url) {
                        AtlasMakerWidget.User.view=stored.history[i].view;
                        AtlasMakerWidget.User.slice=stored.history[i].slice;
                        break;
                    }
                }	
            }
        }

        // enact configuration in param, eventually overriding the stored one
        if(param.view) {
            AtlasMakerWidget.User.view=param.view;
            AtlasMakerWidget.User.slice=null; // this will set the slider to the middle slice in case no slice were specified
        }
        if(param.slice)
            AtlasMakerWidget.User.slice=param.slice;

        if(param.fullscreen)
            AtlasMakerWidget.fullscreen=param.fullscreen;
        else
            AtlasMakerWidget.fullscreen=false;
    
        AtlasMakerWidget.editMode=1;

        AtlasMakerWidget.configureAtlasMaker(BrainBox.info,index)
        .then(function(info2) {
            BrainBox.info = info2;
            def.resolve();
        })
        .catch(function(err) {
            console.log("ERROR:",err);
            def.reject();
        });
		
		return def.promise();
	},
	/**
     * @function convertImgObjectURLToDataURL
     * @desc Encodes the ObjectURL obtained from the server jpg images as DataURL,
     *       suitable to be stored as a string in localStorage
     */
	convertImgObjectURLToDataURL: function convertImgObjectURLToDataURL(objURL) {
	    var def = $.Deferred();
	    var x = new XMLHttpRequest(), f = new FileReader();
        x.open('GET',objURL,true);
        x.responseType = 'blob';
        x.onload = function (e) {
            f.onload = function (evt) {
                def.resolve(evt.target.result);
            };
            f.readAsDataURL(x.response);
        };
        x.send();
        return def;
    },
	/**
     * @function addCurrentMRIToHistory
     */
    addCurrentMRIToHistory: function addCurrentMRIToHistory() {
        var l=BrainBox.traceLog(addCurrentMRIToHistory);if(l)console.log(l);

		BrainBox.convertImgObjectURLToDataURL(AtlasMakerWidget.brain_img.img.src)
		.then(function(data) {
            var i, foundStored=false;
            var stored=localStorage.AtlasMaker;
            if(stored) {
                stored=JSON.parse(stored);
                if(stored.version && stored.version==BrainBox.version) {
                    foundStored=true;
                    for(i=0;i<stored.history.length;i++) {
                        if(stored.history[i].url==BrainBox.info.source) {
                            stored.history.splice(i,1);
                            break;
                        }
                    }
                }
            }
            if(foundStored==false)
                stored={version:BrainBox.version,history:[]};
            stored.history.push({	
                url:         BrainBox.info.source,
                view:        AtlasMakerWidget.User.view?AtlasMakerWidget.User.view.toLowerCase():"sag",
                slice:       AtlasMakerWidget.User.slice?AtlasMakerWidget.User.slice:0,
                img:         data,
                lastVisited: (new Date()).toJSON()
            });
            localStorage.AtlasMaker=JSON.stringify(stored);
	    });
    },
	/**
     * @function unload
     */
	unload: function unload() {
	    /*
		var l=BrainBox.traceLog(unload);if(l)console.log(l);
		var i, obj0, obj1, foundStored=false;
		var stored=localStorage.AtlasMaker;
		if(stored) {
			stored=JSON.parse(stored);
			if(stored.version && stored.version==BrainBox.version) {
				foundStored=true;
				for(i=0;i<stored.history.length;i++) {
					if(stored.history[i].url==BrainBox.info.source) {
						obj0 = stored.history.splice(i,1);
						break;
					}
				}
			}
		}
		if(foundStored==false) {
			stored={version:BrainBox.version,history:[]};
			obj0 = {};
		}
		
        obj1 = {	
			url:BrainBox.info.source,
			view:AtlasMakerWidget.User.view?AtlasMakerWidget.User.view.toLowerCase():"sag",
			slice:AtlasMakerWidget.User.slice?AtlasMakerWidget.User.slice:0,
			lastVisited:(new Date()).toJSON()
		};
        $.extend(obj0, obj1);
		
		stored.history.push(obj0);
        localStorage.AtlasMaker=JSON.stringify(stored);
        */
	},
    /*
		Annotation related functions
	*/
	/**
     * @function selectAnnotationTableRow
     */
	selectAnnotationTableRow: function selectAnnotationTableRow(index,param) {
		var l=BrainBox.traceLog(selectAnnotationTableRow);if(l)console.log(l);
	
		var table=param.table;
		var currentIndex=$(table).find("tr.selected").index();
	
		if(index>=0 && currentIndex!=index) {
			console.log("bb>>  change selected annotation");
			$(table).find("tr").removeClass("selected");
			$(table).find('tbody tr:eq('+index+')').addClass("selected");
			AtlasMakerWidget.configureAtlasMaker(BrainBox.info,index);
		}
	},
	/**
     * @function appendAnnotationTableRow
     */
	appendAnnotationTableRow: function appendAnnotationTableRow(irow,param) {
		var l=BrainBox.traceLog(appendAnnotationTableRow);if(l)console.log(l);
		
		$(param.table).append(param.trTemplate);

		for(var icol=0;icol<param.objTemplate.length;icol++) {
			switch(param.objTemplate[icol].typeOfBinding) {
				case 1:
					bind1(
						param.info_proxy,
						param.info,
						param.objTemplate[icol].path.replace("#",irow),
						$(param.table).find("tr:eq("+(irow+1)+") td:eq("+icol+")"),
						param.objTemplate[icol].format
					);
					break;
				case 2:
					bind2(
						param.info_proxy,
						param.info,
						param.objTemplate[icol].path.replace("#",irow),
						$(param.table).find("tr:eq("+(irow+1)+") td:eq("+icol+")"),
						param.objTemplate[icol].format,
						param.objTemplate[icol].parse
					);
					  break;
			}
		}
	},
	/**
     * @function appendAnnotationTableRow
     */
	appendAnnotationTableRow2: function appendAnnotationTableRow(irow,iarr,param) {
		var l=BrainBox.traceLog(appendAnnotationTableRow);if(l)console.log(l);
		
		$(param.table).append(param.trTemplate);

		for(var icol=0;icol<param.objTemplate.length;icol++) {
			switch(param.objTemplate[icol].typeOfBinding) {
				case 1:
					bind1(
						param.info_proxy,
						param.info,
						param.objTemplate[icol].path.replace("#",iarr),
						$(param.table).find("tr:eq("+(irow+1)+") td:eq("+icol+")"),
						param.objTemplate[icol].format
					);
					break;
				case 2:
					bind2(
						param.info_proxy,
						param.info,
						param.objTemplate[icol].path.replace("#",iarr),
						$(param.table).find("tr:eq("+(irow+1)+") td:eq("+icol+")"),
						param.objTemplate[icol].format,
						param.objTemplate[icol].parse
					);
					  break;
			}
		}
	},
	/**
     * @function loadLabelsets
     */
	loadLabelsets: function loadLabelsets() {
		var l=BrainBox.traceLog(loadLabelsets);if(l)console.log(l);
		
		return $.getJSON("/api/getLabelsets",function(data) {
			BrainBox.labelSets=data;
			/*
				If we wanted to filter out the location, we would use:
				BrainBox.labelSets=$.map(data,function(o){return new URL(o.source).pathname});
			*/
		});
	}
}