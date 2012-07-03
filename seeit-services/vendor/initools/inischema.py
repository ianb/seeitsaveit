"""
**Probably will be deprecated** (13 Aug 2006): I'm not sure if this
is worth keeping around.


.ini file schemas

You can define a schema for your .ini configuration files, which
defines the types and defaults for the values.  You can also define
a catchall attribute.

TODO
----

Currently, this does not deal with sections at all, and sections are
not allowed.  That wil take some more thought, as the schemas will
probably be per-section (though one section may inherit from another,
or defaults may be inherited, etc, which should be allowed for).

Documentation isn't kept track of, nor is it generated.  It should
possible to indicate with ``opt(help=...)``, and as an option
to ``INISchema.ini_repr()`` you should be able to put in documentation
in comments.

Comments aren't kept track of.

Key order isn't kept track of.

Minimal .ini files should be possible to generate -- only generating
keys when the default doesn't match the actual value.

There should be a way to check that the entire config is loaded, and
there are no missing values (options which weren't set and have no
default).

Usage
-----

::

    class VHostSchema(INISchema):

        server_name = opt()
        port = optint(default=80)
        # optlist means this can show up multiple times:
        server_alias = optlist(default=[])
        document_root = opt()

    vhost = VHostSchema()
    vhost.load('config.ini')
    connect(vhost.server_name, vhost.port)
    # etc.

Any schema can contain an ``optdefault()`` object, which will
pick up any keys that aren't specified otherwise (if not present,
extra keys are an error).  Then you'll get a dictionary of lists,
for all the extra config values.  (Use
``optdefault(allow_multiple=False)`` if you want a dictionary of
strings).

If you expect multiple values, use ``optlist(subtype=optsomething())``
for a key.  The values will be collected in a list; if you don't
indicate ``subtype`` then ``opt()`` is used.  Other types are
fairly easy to make through subclassing.

You can generate config files by using ``schema.ini_repr()`` which
will return a string version of the ini file.

Implementation
--------------

This makes heavy use of descriptors.  If you are not familiar with
descriptors, see http://users.rcn.com/python/download/Descriptor.htm

It also makes light use of metaclasses.
"""


import iniparser

class INIMeta(type):

    def __new__(meta, class_name, bases, d):
        cls = type.__new__(meta, class_name, bases, d)
        cls.__classinit__.im_func(cls, d)
        return cls

class ParseValueError(Exception):
    pass

class NoDefault:
    pass

class INISchema(object):

    __metaclass__ = INIMeta

    _default_option = None
    _default_values = None

    _config_names = {}
    _config_names_lower = {}

    case_insensitive = False

    def __classinit__(cls, d):
        # We don't initialize INISchema itself:
        if cls.__bases__ == (object,):
            return
        cls._config_names = cls._config_names.copy()
        cls._config_names_lower = cls._config_names_lower.copy()
        for name, value in d.items():
            if isinstance(value, opt):
                cls.add_option(name, value)
        # @@: We should look for None-ified options, and remove
        # them from cls._config_names

    def add_option(cls, attr_name, option):
        """
        Classmethod: add the option using the given attribute name.
        This can be called after the class has been created, to
        dynamically build up the options.
        """
        if isinstance(option, optdefault):
            # We use a list so that the descriptor behavior doesn't
            # apply here:
            cls._default_option = [option]
            option.attr_name = attr_name
            return
        if option.names is None:
            option.names = [attr_name]
        option.attr_name = attr_name
        for option_name in option.names:
            cls._config_names[option_name] = option
            cls._config_names_lower[option_name.lower()] = option
        option.set_schema(cls)
        setattr(cls, attr_name, option)

    add_option = classmethod(add_option)

    def __init__(self):
        self._ini_attrs = {}

    def set_config_value(self, name, value):
        if self.case_insensitive:
            name = name.lower()
            config_names = self._config_names_lower
        else:
            config_names = self._config_names
        if config_names.has_key(name):
            setattr(self, config_names[name].attr_name, value)
        elif not self._default_option:
            raise ParseValueError(
                "The setting %r was not expected (from %s)"
                % (name, ', '.join(config_names.keys()) or 'none'))
        else:
            self._default_option[0].set_config_value(
                self, name, value)

    def _parser(self):
        return SchemaINIParser(self)

    def load(self, filename, **kw):
        """
        Loads the filename.  Use the encoding keyword argument to
        specify the file's encoding.
        """
        self._parser().load(filename, **kw)

    def loadstring(self, string, **kw):
        """
        Loads the string, which is the content of the ini files.
        Use the filename keyword argument to indicate the filename
        source (or another way to identify the source of the string
        in error messages).
        """
        self._parser().loadstring(string, **kw)

    def as_dict(self, fold_defaults=False):
        """
        Returns the loaded configuration as a dictionary.
        """
        # @@: default values won't show up here
        v = self._ini_attrs.copy()
        if fold_defaults:
            if self._default_values:
                v.update(self._default_values)
        elif self._default_option:
            v[self._default_option[0].attr_name] = self._default_values or {}
        return v

    def ini_repr(self):
        """
        Returns the loaded values as a string, suitable as a
        configuration file.
        """
        config_names = []
        used_options = {}
        for option in self._config_names.values():
            if used_options.has_key(option):
                continue
            used_options[option] = None
            config_names.append((option.names[0], option))
        config_names.sort()
        if self._default_option:
            config_names.append((None, self._default_option[0]))
        result = []
        for name, option in config_names:
            result.append(option.ini_assignment(
                self, getattr(self, option.attr_name)))
        return ''.join(result)
    
class opt(object):

    default = NoDefault

    def __init__(self, names=None, **kw):
        self.names = names
        self.attr_name = None
        self.schema = None
        for name, value in kw.items():
            if not hasattr(self, name):
                raise TypeError(
                    "The keyword argument %s is unknown"
                    % name)
            setattr(self, name, value)

    def set_schema(self, schema):
        self.schema = schema

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        try:
            return obj._ini_attrs[self.attr_name]
        except KeyError:
            if self.default is not NoDefault:
                return self.default
            raise AttributeError(
                "The attribute %s has not been set on %r"
                % (self.attr_name, obj))

    def __set__(self, obj, value):
        new_value = self.convert(obj, value)
        self.validate(obj, new_value)
        self.set_value(obj, new_value)

    def convert(self, obj, value):
        return value

    def validate(self, obj, value):
        pass

    def set_value(self, obj, value):
        obj._ini_attrs[self.attr_name] = value

    def __delete__(self, obj):
        try:
            del obj._ini_attrs[self.attr_name]
        except KeyError:
            raise AttributeError(
                "%r does not have an attribute %s"
                % (obj, self.attr_name))

    def ini_assignment(self, obj, value, name=None):
        if name is None:
            name = self.names[0]
        return '%s=%s\n' % (name,
                            self.ini_fold(self.ini_repr(obj, value)))

    def ini_fold(self, value):
        lines = value.splitlines()
        if len(lines) <= 1:
            return value
        lines = [lines[0]] + ['    ' + l for l in lines[1:]]
        return '\n'.join(lines)

    def ini_repr(self, obj, value):
        return str(value)
    
optstring = opt

class optint(opt):

    max = None
    min = None

    bad_type_message = "You must give an integer number, not %(value)r"
    too_large_message = "The value %(value)s is too large"
    too_small_message = "The value %(value)s is too small"
    coerce = int
    
    def convert(self, obj, value):
        try:
            new_value = self.coerce(value)
        except ValueError:
            raise ParseValueError(
                self.bad_type_message % {'value': value})
        if self.max is not None and new_value > self.max:
            raise ParseValueError(
                self.too_large_message % {'value': value})
        if self.min is not None and new_value < self.min:
            raise ParseValueError(
                self.too_small_message % {'value': value})
        return new_value

class optfloat(optint):
    
    coerce = float
    bad_type_message = "You must give a float number, not %(value)r"

class optbool(opt):

    true_values = ('yes', 'true', '1', 'on')
    false_values = ('no', 'false', '0', 'off')

    def convert(self, obj, value):
        if value.lower() in self.true_values:
            return True
        elif value.lower() in self.false_values:
            return False
        else:
            raise ParseValueError(
                "Should be a boolean value (true/false, on/off, yes/no), not %r"
                % value)

    def ini_repr(self, obj, value):
        if value:
            return 'true'
        else:
            return 'false'

class optlist(opt):

    subtype = opt

    def __init__(self, *args, **kw):
        opt.__init__(self, *args, **kw)
        if isinstance(self.subtype, type):
            self.subtype = self.subtype()

    def convert(self, obj, value):
        return self.subtype.convert(obj, value)

    def validate(self, obj, value):
        self.subtype.validate(obj, value)

    def set_value(self, obj, value):
        obj._ini_attrs.setdefault(self.attr_name, []).append(value)

    def ini_assignment(self, obj, value, name=None):
        if name is None:
            name = self.names[0]
        assert not isinstance(value, (str, unicode)), (
            "optlist attributes should receive lists or sequences, not "
            "strings (%r)" % value)
        all = [self.subtype.ini_assignment(obj, sub, name=name)
               for sub in value]
        return ''.join(all)

class optdefault(opt):

    allow_multiple = True

    def set_config_value(self, obj, name, value):
        if obj._default_values is None:
            obj._default_values = {}
        if self.allow_multiple:
            obj._default_values.setdefault(name, []).append(value)
        else:
            if obj._default_values.has_key(name):
                raise ParseValueError(
                    "You have already set the configuration key %r"
                    % name)
            obj._default_values[name] = value

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        return obj._default_values or {}

    def __set__(self, obj, value):
        raise AttributeError(
            "The attribute %s cannot be set" % self.attr_name)

    def ini_assignment(self, obj, value, name=None):
        assert name is None, "default values can't accept a name"
        all = []
        all_values = self.__get__(obj).items()
        all_values.sort()
        for name, value in all_values:
            if isinstance(value, (str, unicode)):
                value = [value]
            for subvalue in value:
                all.append('%s=%s\n' % (
                    name, self.ini_fold(self.ini_repr(obj, subvalue))))
        return ''.join(all)

class optconverter(opt):

    misc_error_message = "%(error_type)s: %(message)s"
    converter_func = None

    def convert(self, obj, value):
        try:
            return self.converter_func(value)
        except Exception, e:
            raise ParseValueError(
                self.misc_error_message % {
                'message': str(e),
                'error_type': e.__class__.__name__})

    _converters = {}
    def get_converter(cls, name, converter_func):
        if cls._converters.has_key(id(converter_func)):
            return cls._converters[(name, id(converter_func))]
        else:
            converter = cls(name, converter_func=converter_func)
            cls._converters[(name, id(converter_func))] = converter
            return converter
    get_converter = classmethod(get_converter)

class SchemaINIParser(iniparser.INIParser):

    def __init__(self, schema):
        self.schema = schema

    def new_section(self, section):
        self.parse_error("Schemas do not yet support sections")

    def assignment(self, name, content):
        try:
            self.schema.set_config_value(name, content)
        except ParseValueError, e:
            self.parse_error(e.args[0])
