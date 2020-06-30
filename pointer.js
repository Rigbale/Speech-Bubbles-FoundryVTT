Hooks.on('canvasReady', () => {
    canvas.controls.pointer = canvas.controls.addChild(new PointerLayer());
});

class PointerLayer extends PIXI.Container {
    constructor() {
        super();

        // -------------------------------------------------------------- //
        //                  OPTIONS                                       //
        // After changing these options you need to reload the FVTT page  //
        // -------------------------------------------------------------- //
        this.options = {
            key: 88,    // Modify this value to modify the key used.
                        // You need to insert a keycode, not the actual key!
                        // Example codes: - CTRL = 17
                        //                - ALT  = 18
                        //                - C    = 67
            // Pointer options
            pointer: {       
                scale: 1,               // Scale relative to the grid_dim
                svg_name: "pointer.png"     // The svg name
            },
            // Ping options
            ping: {     
                duration: 6,      // Sets the pings duration in seconds
                rotate:   true,      // Toggles Rotation
                rotate_speed: 6,     // Duration in seconds for one complete turn
                size_change:true,           // Toggles Size animation
                size_change_speed: 3,       // Speed for size change animation
                                            // Time for one cycle in seconds
                size_change_amount: 0.125,   // The amount the size changes during one 
                                            // animation cycle
                scale:    1,         // Scales the svg image. The factor is
                                     // relative to the grid dimension.
                svg_use:  false,     // Toggles if default ping should be used or a
                                     // given svg
                svg_name: "focus.svg" // SVG name. The file has to be located in the
                                     // modules repository
                                     // The SVG image will be centered on the 
                                     // clicked point.
            }
        }

        // -------------------------------------------------------------- //
        //                  END OPTIONS                                   //
        // -------------------------------------------------------------- //

        this.socket = 'module.pointer';
        this.arrows = {};
        this.pings = {};
        // Save mousemove in variable so listeners can access *this*
        this._mouseMove = (ev) => this._onMouseMove(ev);
        this._mouseClick = (ev) => this._onMouseClick(ev);
        this._rightClick = (ev) => this._onMouseClick(ev, true);

        this._keyUp = (ev) => this._onKeyUp(ev);
        this._keyDown = (ev) => this._onKeyDown(ev);

        this._getMousePos = (ev) => {
            this.mouse = {
                x: ev.clientX,
                y: ev.clientY
            };
        }

        window.addEventListener('keydown', this._keyDown);
        window.addEventListener('keyup', this._keyUp)
        window.addEventListener('mousemove', this._getMousePos);

        game.socket.on(this.socket, data => {
            this._socketHandler(data);
        });
    }

	destroy(options) {
        this._removeChildren();
		super.destroy(options); 
		this._deactivateListeners(); 
    }
    
    _deactivateListeners() {
        window.removeEventListener('keydown', this._keyDown);
        window.removeEventListener('keyup', this._keyUp);
        window.removeEventListener('mousemove', this._getMousePos);
        game.socket.off(this.socket);
    }

    _onKeyDown(ev) {
        if (ev.repeat)  return;
        if (ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        if ($(":focus").length)
            return;

        if (ev.keyCode === this.options.key) {
            if (!this.sending) {
                ev.preventDefault();
                ev.stopPropagation();
                this.sending = true;
                this._activateMouse(ev);
            }   
        }
    }

    _onKeyUp(ev) {
        if (ev.keyCode === this.options.key) {
            if (this.sending) {
                ev.preventDefault();
                ev.stopPropagation();
                this.sending = false;
                this._deactivateMouse(ev);
            }
        }
    }

    _socketHandler(data) {
        if (data.stop) {
            this._deleteArrow(data.senderId);
        } else {
            if (canvas.scene._id !== data.sceneId)
                return;
            
            this._moveArrow(data);
            if (data.type === "ping") {
                this._ping(data, data.force);
            }
        }
    }

    _activateMouse(ev) {
        window.removeEventListener('mousemove', this._getMousePos);
        canvas.stage.on('mousemove', this._mouseMove);
        canvas.stage.on('mousedown', this._mouseClick);
        if (game.user.isGM) {
            canvas.stage.on('rightdown', this._rightClick);
        }

        // get translated coords immediately
		// show cursor now rather than wait for a movement
		const t = this.worldTransform,
        tx = (this.mouse.x - t.tx) / canvas.stage.scale.x,
        ty = (this.mouse.y - t.ty) / canvas.stage.scale.y; 
        const mdata = {
            senderId: game.user._id,
            position: {x: tx,y: ty},
            sceneId: canvas.scene._id,
            type: "arrow"
        }
        game.socket.emit("module.pointer", mdata);
        this._moveArrow(mdata); 
    }

    _deactivateMouse(ev) {
        
        canvas.stage.off('mousemove', this._mouseMove);
        canvas.stage.off('mousedown', this._mouseClick);
        if (game.user.isGM) {
            canvas.stage.off('rightdown', this._rightClick);
        }
        this._deleteArrow(game.user._id);

        // Send stop signal
        const data = {
            senderId: game.user._id,
            stop: true
        };

        game.socket.emit(this.socket, data);
        window.addEventListener('mousemove', this._getMousePos);
    }

    _onMouseMove(ev) {
        const cursorTime = ev.data.cursorTime || 0;
        const now = Date.now();

        const delta = (cursorTime - (this.lastTime || 0));

        let mdata = {
            senderId: game.user._id,
            position: ev.data.getLocalPosition(canvas.stage),
            sceneId: canvas.scene._id,
            type: "arrow"
        };
        // Only send data 10 times a second
        if (delta > 100) {

            game.socket.emit("module.pointer", mdata);
            this.lastTime = now;
        }
        
        this._moveArrow(mdata);
    }

    _moveArrow(data) {

        // Get the user
        const user = game.users.get(data.senderId);
        let arr = this.arrows[data.senderId];

        if (!arr) {
            this.arrows[data.senderId] = this.addChild(new ArrowPointer(user, data.position, this.options.pointer));
            arr = this.arrows[data.senderId];
        }
        arr.target = {x: data.position.x || 0, y: data.position.y || 0};
    }

    _deleteArrow(userId) {
        if (this.arrows[userId]) {
            this.removeChild(this.arrows[userId]);
            this.arrows[userId].destroy();
            delete this.arrows[userId];
        }
    }

    _onMouseClick(ev, force=false) {
        const data = {
            senderId: game.user._id,
            position: ev.data.getLocalPosition(canvas.stage),
            scale : canvas.stage.transform.scale.x,
            sceneId: canvas.scene._id,
            type: "ping",
            force: force
        };

        this._moveArrow(data);
        game.socket.emit("module.pointer", data);

        this._ping(data, false);
    }

    _ping(data, move_to_ping = true) {
        const user = game.users.get(data.senderId);

        if (user.isGM && move_to_ping) 
            canvas.animatePan({x: data.position.x, y: data.position.y, scale: data.scale});
        
        if (this.pings[user._id]) 
            this.pings[user._id].destroy();
        
        this.pings[user._id] = this.addChild(new Ping(user, data.position,this.options.ping));
    }

    /**
     * Calls destroy for each child (pings and arrows).
     */
    _removeChildren() {
        for (let [key, ping] of Object.entries(this.pings)) {
            if (ping)
                ping.destroy();
        }
        for (let [key, arrow] of Object.entries(this.arrows)) {
            if (arrow) 
                arrow.destroy();
            this.removeChild(arrow);
        }
    }

}

class ArrowPointer extends PIXI.Container {

    constructor(user, pos,  options) {
        super();
        this.target = pos;
        this.x = pos.x;
        this.y = pos.y;
        this.options = options;

        this.draw(user);
        canvas.app.ticker.add(this._animate, this);
    }

    draw(user) {
        const color = user.data.color.replace("#", "0x") || 0x42F4E2;
        const grid_dim = canvas.scene.data.grid;
        let cursor = PIXI.Sprite.from('modules/pointer/' + this.options.svg_name);
        cursor.tint = color;
        cursor.alpha = 1;
        cursor.width = grid_dim * this.options.scale;
        cursor.height = grid_dim * this.options.scale;

        // let cursor_s = PIXI.Sprite.from('modules/pointer/pointer.svg');
        // cursor_s.tint = 0x000000;
        // cursor_s.alpha = 0.8;
        // cursor_s.width = grid_dim;
        // cursor_s.height = grid_dim;
        // cursor_s.filters = [new PIXI.filters.BlurFilter(4)];
        this.addChild(cursor);
    }


    _animate() {
        let dy = this.target.y - this.y,
            dx = this.target.x - this.x;
        if ( Math.abs( dx ) + Math.abs( dy ) < 5 ) {
            this.x = this.target.x;
            this.y = this.target.y;   
            return;
        }

        this.x += dx / 10;
        this.y += dy / 10;
    }

    destroy(options) {
        canvas.app.ticker.remove(this._animate, this);
        super.destroy(options);
    }
}

class Ping extends PIXI.Container {

    constructor(user, pos, options) {
        super();
        this.options = options;
        this.x = pos.x;
        this.y = pos.y;
        this.userId = user._id;
        this.draw(user);
        
        this.t = Date.now();
        this.t_sum = 0;
        canvas.app.ticker.add(this._animate, this);
    }

    draw(user) {
        const color    = user.data.color.replace("#", "0x") || 0x42F4E2,
              alpha    = 1;
        const grid_dim = canvas.scene.data.grid;

        this.grid_dim = grid_dim * this.options.scale;
        
        if (this.options.svg_use) {
            this.ping = PIXI.Sprite.from('modules/pointer/' + this.options.svg_name);
            this.ping.tint = color;
            this.ping.alpha = 0.8;
            this.ping.width = grid_dim;
            this.ping.height = grid_dim;

            this.ping.x = this.ping.y = -grid_dim*0.5;
            this.addChild(this.ping);

        } else {
            let offset   = grid_dim * 0.25;
            this.lines = [];
            this.shadows = [];
            let createObj = (lines, offset, color) => {
    
                for (let i = 0; i < 4; i++) {
                    let line = this.addChild(new PIXI.Graphics());
                    line.lineStyle(2, color, alpha)
                        .moveTo(offset, 0)
                        .lineTo(offset*0.1,offset*0.1)
                        .lineTo(0, offset);
    
                    line.rotation = i * Math.PI / 2;
    
                    lines.push(line);
                }
    
                offset = offset * 0.25;
    
                lines[0].x = lines[0].y = offset;
                lines[1].x = -offset;
                lines[1].y = offset;
                lines[2].x = -offset;
                lines[2].y = -offset;
                lines[3].x = offset;
                lines[3].y = -offset;
            }
            createObj(this.shadows, offset, 0x000000);
            createObj(this.lines, offset, color);
    
            for (let i = 0; i< 4; i++)
                this.shadows[i].filters = [new PIXI.filters.BlurFilter(2)];
            
    
            this.rotation = Math.PI / 3;
        }

        this.width = 0; this.height = 0;
    }

    _animate() {
        const dt = Date.now() - this.t;
        
        const end_phase1 = 500;
        const end_phase2 = end_phase1 + this.options.duration * 1000;
        const end = end_phase2 + 500;
        this.t_sum += dt;
        this.t = Date.now();
        if (this.options.rotate)
            this.rotation += 2 * Math.PI * dt / (this.options.rotate_speed * 1000);
        if (this.t_sum < end_phase1) {
            this.width = this.height = this.t_sum / 500 * this.grid_dim;
        }  else if ( this.t_sum < end_phase2){
            if (this.options.size_change)
                this.width = this.height = this.grid_dim * (1 + Math.sin(2 * Math.PI * this.t_sum / (this.options.size_change_speed * 1000)) * this.options.size_change_amount)
        } else if (this.t_sum < end) {
            this.width = this.height = this.grid_dim *((end-this.t_sum) / 500);
        } else
            this.destroy();
    }

    destroy(options) {
        const parent = this.parent;
        parent.removeChild(parent.pings[this.userId]);
        parent.pings[this.userId] = null;
        canvas.app.ticker.remove(this._animate, this);
        super.destroy(options);
    }
}