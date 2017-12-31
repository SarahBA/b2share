import React from 'react/lib/ReactWithAddons';
import { Link } from 'react-router'
import { Map, List, fromJS } from 'immutable';
import { compare } from 'fast-json-patch';

import Toggle from 'react-toggle';
import { DateTimePicker, Multiselect, DropdownList, NumberPicker } from 'react-widgets';
import moment from 'moment';
import momentLocalizer from 'react-widgets/lib/localizers/moment';
import numberLocalizer from 'react-widgets/lib/localizers/simple-number';
momentLocalizer(moment);
numberLocalizer();

import { serverCache, notifications, Error, browser } from '../data/server';
import { onAjaxError } from '../data/ajax';
import { keys, pairs, objEquals } from '../data/misc';
import { Wait, Err } from './waiting.jsx';
import { HeightAnimate, ReplaceAnimate } from './animate.jsx';
import { getSchemaOrderedMajorAndMinorFields } from './schema.jsx';
import { EditFiles } from './editfiles.jsx';
import { Versions } from './versions.jsx';
import { SelectLicense } from './selectlicense.jsx';
import { SelectBig } from './selectbig.jsx';
import { renderSmallCommunity } from './common.jsx';


const invalidFieldMessage = field => `Please provide a correct value for field: ${field}`;


export const EditRecordRoute = React.createClass({
    isDraft: false,

    getRecordOrDraft() {
        const { id } = this.props.params;
        if (this.isDraft) {
            return serverCache.getDraft(id);
        }
        const record = serverCache.getRecord(id);
        if (record instanceof Error && record.code == 404) {
            this.isDraft = true;
            return serverCache.getDraft(id);
        }
        return record;
    },

    refreshCache() {
        const { id } = this.props.params;
        if (this.isDraft) {
            serverCache.getDraft(id);
        } else {
            serverCache.getRecord(id);
        }
    },

    patchRecordOrDraft(patch, onSuccessFn, onErrorFn) {
        const { id } = this.props.params;
        if (this.isDraft) {
            serverCache.patchDraft(id, patch, onSuccessFn, onErrorFn);
        } else {
            serverCache.patchRecord(id, patch, onSuccessFn, onErrorFn);
        }
    },

    render() {
        const record = this.getRecordOrDraft();
        var role;
        if (!record) {
            return <Wait/>;
        }
        if (record instanceof Error) {
            return <Err err={record}/>;
        }
        // this.props.dataRef.getIn(["user"]).getIn(["roles"]).get(0).getIn(["name"])=='com:e9b9792e79fb4b07b6b4b9c2bd06d095:admin' ? role = 'admin' : role = 'member';
        // console.log("EditRecordRoute >>> render >>> current user role = ", role)
        role = "test"

        const [rootSchema, blockSchemas] = serverCache.getRecordSchemas(record);
        if (rootSchema instanceof Error) {
            return <Err err={rootSchema}/>;
        }
        const community = serverCache.getCommunity(record.getIn(['metadata', 'community']));
        if (community instanceof Error) {
            return <Err err={community}/>;
        }
        return (
            <ReplaceAnimate>
                <EditRecord record={record} community={community}
                            rootSchema={rootSchema} blockSchemas={blockSchemas}
                            refreshCache={this.refreshCache}
                            patchFn={this.patchRecordOrDraft}
                            isDraft={this.isDraft} isVersion={true}
                            role={role} />
            </ReplaceAnimate>
        );
    }
});


const EditRecord = React.createClass({
    getInitialState() {
        return {
            record: null,
            fileState: 'done',
            modal: null,
            errors: {},
            dirty: false,
            waitingForServer: false,
            readOnly: false,
            tmp: null,
            revoking:false,
        };
    },    

    renderFileBlock() {
        const setState = (fileState, message) => {
            const errors = this.state.errors;
            if (fileState === 'done') {
                delete errors.files;
            } else if (fileState === 'error') {
                errors.files = message;
            } else {
                errors.files = 'Waiting for files to finish uploading';
            }
            this.setState({fileState, errors});
        }
        const files = this.props.record.get('files');
        if (files instanceof Error) {
            return <Err err={files}/>;
        }
        return (
            <EditFiles files={files ? files.toJS() : []}
                record={this.props.record}
                setState={setState}
                setModal={modal => this.setState({modal})}
                readOnly={this.state.readOnly} />
        );
    },

    setError(id, msg) {
        const err = this.state.errors;
        err[id] = msg;
        this.setState({errors: this.state.errors});
    },

    getValue(path) {
        const r = this.state.record;
        if (!r) {
            return null;
        }
        let v = r.getIn(path);
        if (v != undefined && v != null && v.toJS) {
            v = v.toJS();
        }
        return v;
    },

    setValue(schema, path, value) {
        // console.log("setValue >>>")
        let r = this.state.record;
        if (!r) {
            return null;
        }
        for (let i = 0; i < path.length; ++i) {
            const el = path[i];
            if (Number.isInteger(el)) {
                console.assert(i > 0);
                const subpath = path.slice(0, i);
                const list = r.getIn(subpath);
                if (!list) {
                    r = r.setIn(subpath, List());
                } else {
                    console.assert(el < 1000);
                    while (el >= list.count()) {
                        const x = Number.isInteger(path[i+1]) ? List() : Map();
                        const list2 = list.push(x);
                        r = r.setIn(subpath, list2);
                    }
                }
            }
        }
        console.assert(!Array.isArray(value));
        if(typeof value === 'string' || value instanceof String) {
            value = value.replace(/^\s+/, '').replace(/\s+$/, ' ') ;
        }

        r = value !== undefined ? r.setIn(path, value) : r.deleteIn(path);
        const errors = this.state.errors;
        const pathstr = path.join('/');
        if (!this.validField(schema, value)) {
            errors[pathstr] = invalidFieldMessage(pathstr);
        } else {
            delete errors[pathstr];
        }
        this.setState({record:r, errors, dirty:true});
    },

    renderScalarField(schema, path) {
        const pathstr = path.join('/');
        const validClass = (this.state.errors[pathstr]) ? " invalid-field " : "";
        const type = schema.get('type');
        const value = this.getValue(path);
        const setter = x => this.setValue(schema, path, x);
        if (type === 'boolean') {
            return (
                <div className={validClass} style={{lineHeight:"30px"}}>
                    <Toggle checked={value} onChange={event => setter(event.target.checked)}/>
                    <div style={{display:"inline", "verticalAlign":"super"}}>{value ? " True" : " False"}</div>
                </div>
            );
        } else if (type === 'integer') {
            return <NumberPicker className={validClass} defaultValue={value} onChange={setter} />
        } else if (type === 'number') {
            return <NumberPicker className={validClass} defaultValue={value} onChange={setter} />
        } else if (type === 'string') {
            const value_str = ""+(value || "");
            if (schema.get('enum')) {
                return <DropdownList className={validClass} defaultValue={value_str} data={schema.get('enum').toJS()} onChange={setter} />
            } else if (schema.get('format') === 'date-time') {
                const initial = (value_str && value_str !== "") ? moment(value_str).toDate() : null;
                return <DateTimePicker className={validClass} defaultValue={initial}
                        onChange={date => setter(moment(date).toISOString())} />
            } else if (schema.get('format') === 'email') {
                return <input type="text" className={"form-control"+ validClass} placeholder="email@example.com"
                        value={value_str} onChange={event => setter(event.target.value)} />
            } else if (path[path.length-1] === 'description') {
                return <textarea className={"form-control"+ validClass} rows={value_str.length > 1000 ? 10 : 5}
                        value={value_str} onChange={event => setter(event.target.value)} />
            } else {
                return <input type="text" className={"form-control"+ validClass}
                        value={value_str} onChange={event => setter(event.target.value)} />
            }
        } else if (schema.get('enum')) {
            const value_str = ""+(value || "");
            return <DropdownList className={"form-control"+ validClass} data={schema.get('enum').toJS()}
                     defaultValue={value_str} onChange={setter} />
        } else {
            console.error("Cannot render field of schema:", schema.toJS());
        }
    },

    renderLicenseField(schema, path) {
        const onSelect = (license) => {
            console.assert(path.length >= 1);
            const licenseData = {
                'license': license.name,
                'license_uri': license.url,
            };
            this.setValue(schema, path.slice(0, -1), fromJS(licenseData));
        };
        return (
            <div className="input-group" style={{marginTop:'0.25em', marginBottom:'0.25em'}}>
                { this.renderScalarField(schema, path) }
                <SelectLicense title="Select License" onSelect={onSelect}
                    setModal={modal => this.setState({modal})} />
            </div>
        );
    },

    renderOpenAccessField(schema, path, disabled) {
        const value = this.getValue(path);
        return (
            <div style={{lineHeight:"30px"}}>
                <Toggle checked={value} onChange={event => this.setValue(schema, path, event.target.checked)} disabled={disabled}/>
                <div style={{display:"inline", "verticalAlign":"super"}}>{value ? " True" : " False"}</div>
            </div>
        );
    },

    renderEmbargoField(schema, path) {
        const date = this.getValue(path);
        const initial = (date && date !== "") ? moment(date).toDate() : null;
        const onChange = date => {
            const m = moment(date);
            // true if embargo is in the past
            const access = m.isValid() ? (moment().diff(m) > 0) : true;
            this.state.record = this.state.record.set('open_access', access);
            // setValue will call setState
            this.setValue(schema, path, m.isValid() ? m.toISOString() : undefined);
        };
        return (
            <DateTimePicker format={"LL"} time={false} finalView={"year"}
                        defaultValue={initial} onChange={onChange} disabled={this.state.readOnly} />
        );
    },

    renderFieldTree(id, schema, path) {
        if (!schema) {
            return false;
        }
        const newpath = (last) => { const np = path.slice(); np.push(last); return np; };

        let field = false;
        if (objEquals(path, ['community'])) {
            field = this.props.community ? renderSmallCommunity(this.props.community) : <Wait/>
        } else if (objEquals(path, ['license', 'license'])) {
            field = this.renderLicenseField(schema, path);
        } else if (objEquals(path, ['open_access'])) {
            const embargo = this.getValue(schema, newpath('embargo_date'));
            const disabled = embargo && moment(embargo).isValid();
            field = this.renderOpenAccessField(schema, path, disabled);
        } else if (objEquals(path, ['embargo_date'])) {
            field = this.renderEmbargoField(schema, path);
        } else if (objEquals(path, ['language']) || objEquals(path, ['language_code'])) {
            const languages = serverCache.getLanguages();
            field = (languages instanceof Error) ? <Err err={languages}/> :
                <SelectBig data={languages}
                    onSelect={x=>this.setValue(schema, path, x)} value={this.getValue(path)} readOnly={this.state.readOnly} />;
        } else if (path.length === 2 && path[0] === 'disciplines') {
            const disciplines = serverCache.getDisciplines();
            field = (disciplines instanceof Error) ? <Err err={disciplines}/> :
                <SelectBig data={disciplines}
                    onSelect={x=>this.setValue(schema, path, x)} value={this.getValue(path)} readOnly={this.state.readOnly} />;
        } else if (schema.get('type') === 'array') {
            const itemSchema = schema.get('items');
            const raw_values = this.getValue(path);
            const len = (raw_values && raw_values.length) || 1;
            const arrField = [...Array(len).keys()].map(i =>
                this.renderFieldTree(id+`[${i}]`, itemSchema, newpath(i)));
            const btnAddRemove = (ev, pos) => {
                ev.preventDefault();
                if (pos === 0) {
                    const itemType = itemSchema.get('type');
                    const values = this.state.record.getIn(path) || List();
                    const newItem = itemType === 'array' ? List() : itemType === 'object' ? Map() : null;
                    let newValues = values.push(newItem);
                    if (newValues.count() == 1) {
                        // added value starting from an empty container; 2 values needed
                        newValues = newValues.push(newItem);
                    }
                    this.setValue(schema, path, newValues);
                } else {
                    this.setValue(schema, newpath(pos), undefined);
                }
            }
            field = arrField.map((f, i) =>
                <div className="container-fluid" key={id+`[${i}]`}>
                    <div className="row" key={i} style={{marginBottom:'0.5em'}}>
                        {f}
                        <div className={"col-sm-offset-10 col-sm-2"} style={{paddingRight:0}}>
                            <btn className="btn btn-default btn-xs" style={{float:'right'}} onClick={ev => btnAddRemove(ev, i)}>
                                {i == 0 ?
                                    <span><span className="glyphicon glyphicon-plus-sign" aria-hidden="true"/> Add </span> :
                                    <span><span className="glyphicon glyphicon-minus-sign" aria-hidden="true"/> Remove </span>
                                }
                            </btn>
                        </div>
                    </div>
                </div> );
        } else if (schema.get('type') === 'object') {
            const props = schema.get('properties');
            field = schema.get('properties').entrySeq().map(([pid, pschema]) =>
                        this.renderFieldTree(pid, pschema, newpath(pid)));
        } else {
            field = this.renderScalarField(schema, path);
        }

        const arrstyle = schema.get('type') !== 'array' ? {} : {
            paddingLeft:'10px',
            borderLeft:'1px solid black',
            borderRadius:'4px',
        };
        const pathstr = path.join('/');
        const isError = this.state.errors.hasOwnProperty(pathstr);
        const onfocus = () => { this.setState({showhelp: path.slice()}); }
        const onblur = () => { this.setState({showhelp: null}); }
        const title = schema.get('title');
        return (
            <div className="row" key={id}>
                <div key={id} style={{marginBottom:'0.5em'}} title={schema.get('description')}>
                    {!title ? false :
                        <label htmlFor={id} className="col-sm-3 control-label" style={{fontWeight:'bold'}}>
                            <span style={{float:'right', color:isError?'red':'black'}}>
                                {title} {schema.get('isRequired') ? "*":""}
                            </span>
                        </label> }
                    <div className={title ? "col-sm-9":"col-sm-12"} style={arrstyle} onFocus={onfocus} onBlur={onblur}>
                        <div className="container-fluid" style={{paddingLeft:0, paddingRight:0}}>
                            {field}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="col-sm-offset-3 col-sm-9">
                        <HeightAnimate>
                            { this.state.showhelp && objEquals(this.state.showhelp, path) ?
                                <div style={{marginLeft:'1em', paddingLeft:'1em', borderLeft: '1px solid #eee'}}>
                                    <p> {schema.get('description')} </p>
                                </div>
                              : false }
                        </HeightAnimate>
                    </div>
                </div>
            </div>
        );
    },

    renderFieldBlock(schemaID, schema) {
        if (!schema) {
            return <Wait key={schemaID}/>;
        }
        let open = this.state.folds ? this.state.folds[schemaID||""] : false;
        const plugins = schema.getIn(['b2share', 'plugins']);

        function renderBigFieldTree([pid, pschema]) {
            const datapath = schemaID ? ['community_specific', schemaID, pid] : [pid];
            const f = this.renderFieldTree(pid, pschema, datapath);
            if (!f) {
                return false;
            }
            const style = {
                marginTop:'0.25em',
                marginBottom:'0.25em',
                paddingTop:'0.25em',
                paddingBottom:'0.25em',
            };
            return <div style={style} key={pid}> {f} </div>;
        }
        const [majors, minors] = getSchemaOrderedMajorAndMinorFields(schema);

        const majorFields = majors.entrySeq().map(renderBigFieldTree.bind(this));
        const minorFields = minors.entrySeq().map(renderBigFieldTree.bind(this));

        const onMoreDetails = e => {
            e.preventDefault();
            const folds = this.state.folds || {};
            folds[schemaID||""] = !folds[schemaID||""];
            this.setState({folds:folds});
        }

        const foldBlock = minorFields.count() ? (
            <div className="col-sm-12">
                <div className="row">
                    <div className="col-sm-offset-3 col-sm-9" style={{marginTop:'1em', marginBottom:'1em'}}>
                        <a href="#" onClick={onMoreDetails} style={{padding:'0.5em'}}>
                            { !open ?
                                <span>Show more details <span className="glyphicon glyphicon-chevron-right" style={{top:'0.1em'}} aria-hidden="true"/></span>:
                                <span>Hide details <span className="glyphicon glyphicon-chevron-down" style={{top:'0.2em'}} aria-hidden="true"/></span> }
                        </a>
                    </div>
                </div>
                <HeightAnimate delta={20}>
                    { open ? minorFields : false }
                </HeightAnimate>
            </div>
        ) : false;

        const blockStyle=schemaID ? {marginTop:'1em', paddingTop:'1em', borderTop:'1px solid #eee'} : {};
        return (
            <div style={blockStyle} key={schemaID}>
                <div className="row">
                    <h3 className="col-sm-12" style={{marginBottom:0}}>
                        { schemaID ? schema.get('title') : 'Basic fields' }
                    </h3>
                </div>
                <div className="row">
                    <div className="col-sm-12">
                        { majorFields }
                    </div>
                </div>
                <div className="row">
                    { foldBlock }
                </div>
            </div>
        );
    },

    componentWillMount() {
        this.componentWillReceiveProps(this.props);
    },

    componentWillReceiveProps(props) {
        if (props.record && !this.state.record) {
            let record = props.record.get('metadata');
            if (!record.has('community_specific')) {
                record = record.set('community_specific', Map());
            }
            record = addEmptyMetadataBlocks(record, props.blockSchemas) || record;
            this.setState({record});
            this.setState({tmp:record.get('publication_state')})
        } else if (this.state.record && props.blockSchemas) {
            const record = addEmptyMetadataBlocks(this.state.record, props.blockSchemas);
            if (record) {
                this.setState({record});
            }
        }

        // when record is submitted for review: the publication_state is 'submitted' and readonly should be True
        if(this.props.community && this.state.record){ // ?? chera this.props.community ro check kardam?!!  chon khate bad age ina null bashan error migiram!
            if(this.props.community.getIn(["publication_workflow"])=='review_and_publish' && this.state.record.get('publication_state')=='submitted' && !this.state.revoking){
                console.log("oOoOoOooOoOoOOoOo")
                this.setState({readOnly:true});
            }            
        }

        if(this.state.revoking){ // when a submitted record is supposed to be revoked (Edit button was pressed)
            // console.log("?????????????????????? this.state.tmp = ", this.state.tmp,
            //              " , this.state.readOnly = ", this.state.readOnly,
            //              " , this.state.record.get('publication_state') = ", this.state.record.get('publication_state'))
            this.forceUpdate();
            // this.props.refreshCache();
            // this.setState({tmp:null})
        }

        function addEmptyMetadataBlocks(record, blockSchemas) {
            if (!blockSchemas || !blockSchemas.length) {
                return false;
            }
            let updated = false;
            blockSchemas.forEach(([blockID, _]) => {
                if (!record.get('community_specific').has(blockID)) {
                    record = record.setIn(['community_specific', blockID], Map());
                    updated = true;
                }
            });
            return updated ? record : null;
        }
    },

    // shouldComponentUpdate: function(nextProps, nextState) {
    //     console.log(".......shouldComponentUpdate......")
    //     console.log("nextState.revoking = ", nextState.revoking)
    //     return nextState.revoking
    // },

    validField(schema, value) {
        if (schema && schema.get('isRequired')) {
            if (!this.props.isDraft || this.isForPublication()) {
                // 0 is fine
                if (value === undefined || value === null || (""+value).trim() === "")
                    return false;
            }
        }
        return true;
    },

    findValidationErrorsRec(errors, schema, path, value) {
        const isValue = (value !== undefined && value !== null && value !== "");
        if (schema.get('isRequired') && !isValue) {
            if (!this.props.isDraft || this.isForPublication()) {
                const pathstr = path.join("/");
                errors[pathstr] = invalidFieldMessage(pathstr);
                return;
            }
        }

        const newpath = (last) => { const np = path.slice(); np.push(last); return np; };
        const type = schema.get('type');
        if (type === 'array') {
            if (isValue && schema.get('items')) {
                value.forEach((v, i) =>
                    this.findValidationErrorsRec(errors, schema.get('items'), newpath(i), v));
            }
        } else if (type === 'object') {
            if (isValue && schema.get('properties')) {
                schema.get('properties').entrySeq().forEach(([pid, pschema]) =>
                    this.findValidationErrorsRec(errors, pschema, newpath(pid), value.get(pid)));
            }
        } else {
            if (!this.validField(schema, value)) {
                const pathstr = path.join("/");
                errors[pathstr] = invalidFieldMessage(pathstr);
            }
        }
    },

    findValidationErrors() {
        const rootSchema = this.props.rootSchema;
        const blockSchemas = this.props.blockSchemas || [];
        if (!rootSchema) {
            return;
        }
        const errors = {};
        const r = this.state.record;

        this.findValidationErrorsRec(errors, rootSchema, [], r);
        blockSchemas.forEach(([blockID, blockSchema]) => {
            const schema = blockSchema.get('json_schema');
            const path = ['community_specific', blockID];
            this.findValidationErrorsRec(errors, schema, path, r.getIn(path));
        });

        if (this.state.errors.files) {
            errors.files = this.state.errors.files;
        }
        return errors;
    },

    componentDidUpdate(prevProps, prevState) {
        const original = this.props.record.get('metadata').toJS();
        let updated = this.state.record.toJS();
        // when the checkbox is ticked and the record is going to be "submitted" for review by admin 
        if (prevState.record.getIn(['publication_state']) !== this.state.record.getIn(['publication_state']) && !this.state.revoking){// && this.state.record.getIn(['publication_state'])=='submitted' ){ //shayad dovomin shart lazem nabashe???!!
        // if (this.state.record.getIn(['publication_state']) == 'submitted' && !this.state.revoking){// && this.state.record.getIn(['publication_state'])=='submitted' ){ //shayad dovomin shart lazem nabashe???!!
            console.log("^^^^^^^^^^^^^^^") 
            const patch = compare(original, updated);
            console.log("componentDidUpdate >> patch = ", patch)
            if (!patch || !patch.length) {
                this.setState({dirty:false});
                return;
            }
            this.applyPatch(patch, 'submitted');
        }

        // when the submitted record is going to be revoked (after editSubmittedRecord() is called and revoking state is chahged)
        if(prevState.revoking !== this.state.revoking && this.state.revoking){ //this.state.record.getIn(['publication_state']????
            console.log("+++++++++++++++++")
            updated['publication_state'] = 'draft'
            const patch = compare(original, updated);
            this.applyPatch(patch, 'edit');
            // return;
        }
    },

    updateSates(event) {
        event.preventDefault();
        console.log("........ updateSates")
        const errors = this.findValidationErrors();
        if (this.state.fileState !== 'done' || pairs(errors).length > 0) {
            this.setState({errors});
            return;
        }

        if(this.state.tmp == 'draft'){
            // when the save draft button is pressed, so just save the differences
            const original = this.props.record.get('metadata').toJS();
            const updated = this.state.record.toJS();
            const patch = compare(original, updated);
            if (!patch || !patch.length) {
                this.setState({dirty:false});
                return;
            }
            this.applyPatch(patch, 'save_draft');
        } else if(this.state.tmp == 'published' && this.state.record.get('publication_state') == 'published'){
            //when there is a published record like bbmri that is going to be edited!
            const original = this.props.record.get('metadata').toJS();
            const updated = this.state.record.toJS();
            const patch = compare(original, updated);
            if (!patch || !patch.length) {
                this.setState({dirty:false});
                return;
            }
            this.applyPatch(patch, 'edit_metadata');
        } else {
            //when record is going to be submitted for review, through componentDidUpdate
            const record = this.state.record.set('publication_state', this.state.tmp);
            this.setState({record});
        }
    },

    // updateRecord(patch) {
    applyPatch(patch, caseValue) {
        console.log(".... applyPatch .... caseValue = ", caseValue)
        let afterPatch;
        switch (caseValue) {
            case 'submitted':
                console.log("switch > case > submitted")
                afterPatch = (record) => {
                    // when EUDAT record is sent for review
                    if (this.props.community.getIn(["publication_workflow"]) == 'review_and_publish'){ 
                        this.setState({dirty:false, waitingForServer: false, readOnly: true});
                        console.log("............... second")//, this.state.tmp = ", this.state.tmp)
                        notifications.warning(`This record is submitted and waiting for review by your community administrator`);
                        browser.gotoEditRecord(record.id);
                    } else {
                        //when workflow is direct publish, like BBMRI
                        console.log("............. third, recordID = ", record.id)
                        browser.gotoRecord(record.id);
                    } 
                }
                break;

            case 'edit':
                console.log("switch > case > edit")
                afterPatch = (record) => {
                    // this.setState({dirty:false, waitingForServer: false, readOnly: false}); // dirty va readOnly ro ghablan avaz kardam, az inja pak konam???
                    this.setState({waitingForServer: false, revoking: false});
                    console.log("............... Five")
                    notifications.clearAll();
                    // notifications.warning(`This record is submitted and waiting for review by your community administrator`);
                    browser.gotoEditRecord(record.id);
                }
                break;

            case 'save_draft':
                console.log("switch > case > save_draft")
                afterPatch = (record) => {
                    if (this.props.isDraft && !this.isForPublication()) { // shayad in if ro dige nakhaym!!???
                        console.log("................ first ")// , this.isForPublication() = ", this.isForPublication())
                        this.props.refreshCache();
                        // TODO(edima): when a draft is publised, clean the state of
                        // records in versioned chain, to trigger a refetch of
                        // versioning data
                        this.setState({dirty:false, waitingForServer: false});
                        notifications.clearAll();
                    }
                }
                break;

            case 'edit_metadata':
                console.log("switch > case > edit_metadata")
                afterPatch = (record) => {
                    console.log("................ six ")// , this.isForPublication() = ", this.isForPublication())
                    // TODO(edima): when a draft is publised, clean the state of
                    // records in versioned chain, to trigger a refetch of
                    // versioning data
                    this.setState({dirty:false, waitingForServer: false});
                    notifications.clearAll();
                    browser.gotoRecord(record.id);
                }
                break;
        }

        const onError = (xhr) => {
            // console.log(">>>>> onError > xhr = ", xhr)
            this.setState({waitingForServer: false});
            onAjaxError(xhr);
            try {
                const errors = JSON.parse(xhr.responseText).errors;
                // console.log(">>>>> onError > errors = ", errors)
                errors.map(err => {
                    notifications.warning(`Error in field '${err.field}': ${err.message}`);
                });
            } catch (_) {
            }
        }
        this.setState({waitingForServer: true});
        this.props.patchFn(patch, afterPatch, onError);
    },

    editSubmittedRecord(event){
        event.preventDefault();
        console.log("00000000000000 editSubmittedRecord 0000000000")
        const record = this.state.record.set('publication_state', "draft");
        this.setState({record});
        this.setState({dirty:false, tmp:'draft', revoking:true, readOnly:false}); // tmp: draft or null???
    },

    isForPublication() {
        // return this.state.record.get('publication_state') == 'submitted';
        // console.log("isForPublication > this.state.tmp == 'submitted' is ", this.state.tmp == 'submitted')
        return this.state.tmp == 'submitted';
        // return this.state.tmp == 'draft';
    },

    setPublishedState(e) {
        // console.log("setPublishedState >>>> e.target.checked = ", e.target.checked)
        const state = e.target.checked ? 'submitted' : 'draft';
        // const state = e.target.checked ? 'draft' : 'submitted';
        // const record = this.state.record.set('publication_state', state);
        // this.setState({record});
        console.log("setPublishedState >>>> state = ", state)
        this.setState({tmp:state});
        // console.log("setPublishedState >>>> this.state.tmp = ", this.state.tmp)
    },

    renderUpdateRecordForm() {//?????????????/ onClick?????????/
        const klass = this.state.waitingForServer ? 'disabled' :
                      this.state.dirty ? 'btn-primary' : 'disabled';
        const text = this.state.waitingForServer ? "Updating record, please wait...":
                     this.state.dirty ? "Update record" : "The record is up to date";
        console.log("....renderUpdateRecordForm......")
        return (
            <div className="col-sm-offset-3 col-sm-9">
                <p>This record is already published. Any changes you make will be directly visible to other people.</p>
                <button type="submit" className={"btn btn-default btn-block "+klass} onClick={this.updateSates}>{text}</button> 
            </div>
        );
    },

    renderSubmitDraftForm() {
        if(this.props.community){
            if(this.props.community.getIn(["publication_workflow"]) == 'review_and_publish'){
                const klass = this.state.waitingForServer ? 'disabled' :
                              this.isForPublication() ? 'btn-primary btn-danger' :
                              this.state.dirty ? 'btn-primary' : 'disabled';
                const text = this.state.waitingForServer ? "Updating record, please wait..." :
                              this.isForPublication() ? 'Save and submit for review' :
                              this.state.dirty ? 'Save Draft' : 'The draft is up to date';
                // console.log("renderSubmitDraftForm >>> this.isForPublication() = ", this.isForPublication(), " , workflow = ", this.props.community.getIn(["publication_workflow"]), "  , dirty = ", this.state.dirty )
                return (
                    <div className="col-sm-offset-3 col-sm-9">
                        <label style={{fontSize:18, fontWeight:'normal'}}>
                            <input type="checkbox" value={this.isForPublication} onChange={this.setPublishedState}/>
                            {" "}Submit draft for review by your community administrator
                        </label>
                        <p> ??? some description ??? </p>
                        <button type="submit" className={"btn btn-default btn-block "+klass} onClick={this.updateSates}>{text}</button>
                    </div>
                );
            } else {
                const klass = this.state.waitingForServer ? 'disabled' :
                              this.isForPublication() ? 'btn-primary btn-danger' :
                              this.state.dirty ? 'btn-primary' : 'disabled';
                const text = this.state.waitingForServer ? "Updating record, please wait..." :
                              this.isForPublication() ? 'Save and Publish' :
                              this.state.dirty ? 'Save Draft' : 'The draft is up to date';
                // console.log("renderSubmitDraftForm >>> this.isForPublication() = ", this.isForPublication(), " , workflow = ", this.props.community.getIn(["publication_workflow"]), "  , dirty = ", this.state.dirty )
                return (
                    <div className="col-sm-offset-3 col-sm-9">
                        <label style={{fontSize:18, fontWeight:'normal'}}>
                            <input type="checkbox" value={this.isForPublication} onChange={this.setPublishedState}/>
                            {" "}Submit draft for publication
                        </label>
                        <p>When the draft is published it will be assigned a PID, making it publicly citable.
                            But a published record's files can no longer be modified by its owner. </p>
                        <button type="submit" className={"btn btn-default btn-block "+klass} onClick={this.updateSates}>{text}</button>
                    </div>
                );
            }

        }
    },

    render() {
        const rootSchema = this.props.rootSchema;
        const blockSchemas = this.props.blockSchemas;
        if (!this.state.record || !rootSchema) {
            return <Wait/>;
        }
        const editTitle = "Editing " + (this.props.isDraft ? "draft" : "record") + (this.props.isVersion ?  " version": "");
        // var ttt = this.props.community.get("publication_workflow")
        // console.log("EditRecord >>> render >>> this.props.community = ", ttt ) 
        // this.isForReview()
        console.log("\n\n workflow = ", this.props.community.getIn(["publication_workflow"]), 
                    ", this.props.isDraft = ", this.props.isDraft,
                    ", this.state.record.get.publication_state = ", this.state.record.get('publication_state') ,
                    ", this.state.readOnly = ", this.state.readOnly,
                    ", this.state.tmp  = ", this.state.tmp,
                    ", this.props.record.get.publication_state  = ", this.props.record.get('metadata').get('publication_state'),
                     "\n\n")
        return ( /// onSubmit={this.updateRecord ?????????????
            <div className="edit-record">
                <Versions isDraft={this.props.isDraft}
                          recordID={this.props.record.get('id')}
                          versions={this.props.record.get('versions')}/>

                <div className="row">
                    <div className="col-xs-12">
                        <h2 className="name">
                            <span style={{color:'#aaa'}}>{editTitle}</span>
                            {this.state.record.get('title')}
                        </h2>
                    </div>
                </div>
                <div style={{position:'relative', width:'100%'}}>
                    <div style={{position:'absolute', width:'100%', zIndex:1}}>
                        { this.state.modal }
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-12">
                        { this.props.isDraft ? this.renderFileBlock() : false }
                    </div>
                    <div className="col-xs-12">
                    <fieldset disabled={this.state.readOnly}>
                        <form className="form-horizontal" onSubmit={this.updateRecord}>
                            { this.renderFieldBlock(null, rootSchema) }

                            { !blockSchemas ? false :
                                blockSchemas.map(([id, blockSchema]) =>
                                    this.renderFieldBlock(id, (blockSchema||Map()).get('json_schema'))) }
                        </form>
                    </fieldset>
                    </div>
                </div>
                <div className="row">
                    {this.state.record.get('publication_state') == 'submitted' && this.state.readOnly ?
                        <div className="form-group submit row" style={{margin:'2em 0', paddingTop:'2em', borderTop:'1px solid #eee'}}>
                            <div className="col-sm-offset-3 col-sm-9">
                                <p> Note that by editing the record, it will be revoked and won't being reviewd by your community admin anymore. You will need to submit it again. </p>
                                <button type="submit" className={"btn btn-default btn-block btn-primary btn-danger "} onClick={this.editSubmittedRecord}>Edit</button>
                            </div>
                        </div>
                    :
                        <div className="form-group submit row" style={{margin:'2em 0', paddingTop:'2em', borderTop:'1px solid #eee'}}>
                            {pairs(this.state.errors).map( ([id, msg]) =>
                                <div className="col-sm-offset-3 col-sm-9 alert alert-warning" key={id}>{msg} </div>) }
                            { this.props.isDraft ? this.renderSubmitDraftForm() : this.renderUpdateRecordForm() }
                        </div>
                    }
                </div>
            </div>
        ); //<!-- // shayad faghat readonly kafi bood?!! -->
        // {this.state.record.get('publication_state') == 'submitted' && this.state.readOnly ? console.log(this.state.record , " , RAEDooOoooonly") : console.log(this.state.record ," , Beeeeeep") }
    }
});
